"""Module containing functions for cloning a Git repository to a local path."""

from __future__ import annotations

import asyncio
import functools
import logging
from pathlib import Path
from typing import TYPE_CHECKING, TypeVar

import git

from core.config import DEFAULT_TIMEOUT
from core.utils.git_utils import (
    check_repo_exists,
    checkout_partial_clone,
    create_git_repo,
    ensure_git_installed,
    git_auth_context,
    is_github_host,
    resolve_commit,
)


async def ensure_directory_exists_or_create(path: Path) -> None:
    """Ensure the directory exists, creating it if necessary."""
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        msg = f"Failed to create directory {path}: {exc}"
        raise OSError(msg) from exc

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from typing import ParamSpec

    from core.schemas import CloneConfig

    P = ParamSpec("P")

T = TypeVar("T")

# Initialize logger for this module
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Inlined async_timeout decorator (replaces gitingest.utils.timeout_wrapper)
# ---------------------------------------------------------------------------

class AsyncTimeoutError(Exception):
    """Exception raised when an async operation exceeds its timeout limit."""


def async_timeout(seconds: int) -> Callable:
    """Async timeout decorator.

    This decorator wraps an asynchronous function and ensures it does not run for
    longer than the specified number of seconds. If the function execution exceeds
    this limit, it raises an ``AsyncTimeoutError``.

    Parameters
    ----------
    seconds : int
        The maximum allowed time (in seconds) for the asynchronous function to complete.

    Returns
    -------
    Callable
        A decorator that, when applied to an async function, ensures the function
        completes within the specified time limit.

    """

    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @functools.wraps(func)
        async def wrapper(*args: object, **kwargs: object) -> T:
            try:
                return await asyncio.wait_for(func(*args, **kwargs), timeout=seconds)
            except TimeoutError as exc:
                msg = f"Operation timed out after {seconds} seconds"
                raise AsyncTimeoutError(msg) from exc

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# Main clone logic
# ---------------------------------------------------------------------------


@async_timeout(DEFAULT_TIMEOUT)
async def clone_repo(config: CloneConfig, *, token: str | None = None) -> None:
    """Clone a repository to a local path based on the provided configuration.

    This function handles the process of cloning a Git repository to the local file system.
    It can clone a specific branch, tag, or commit if provided, and it raises exceptions if
    any errors occur during the cloning process.

    Parameters
    ----------
    config : CloneConfig
        The configuration for cloning the repository.
    token : str | None
        GitHub personal access token (PAT) for accessing private repositories.

    Raises
    ------
    ValueError
        If the repository is not found, if the provided URL is invalid, or if the token format is invalid.
    RuntimeError
        If Git operations fail during the cloning process.

    """
    # Extract and validate query parameters
    url: str = config.url
    local_path: str = config.local_path
    partial_clone: bool = config.subpath != "/"

    logger.info(
        "Starting git clone operation",
        extra={
            "url": url,
            "local_path": local_path,
            "partial_clone": partial_clone,
            "subpath": config.subpath,
            "branch": config.branch,
            "tag": config.tag,
            "commit": config.commit,
            "include_submodules": config.include_submodules,
        },
    )

    logger.debug("Ensuring git is installed")
    await ensure_git_installed()

    logger.debug("Creating local directory", extra={"parent_path": str(Path(local_path).parent)})
    await ensure_directory_exists_or_create(Path(local_path).parent)

    logger.debug("Checking if repository exists", extra={"url": url})
    if not await check_repo_exists(url, token=token):
        logger.error("Repository not found", extra={"url": url})
        msg = "Repository not found. Make sure it is public or that you have provided a valid token."
        raise ValueError(msg)

    logger.debug("Resolving commit reference")
    commit = await resolve_commit(config, token=token)
    logger.debug("Resolved commit", extra={"commit": commit})

    # Clone the repository using GitPython with proper authentication
    logger.info("Executing git clone operation", extra={"url": "<redacted>", "local_path": local_path})
    try:
        clone_kwargs = {
            "single_branch": True,
            "no_checkout": True,
            "depth": 1,
        }

        with git_auth_context(url, token) as (git_cmd, auth_url):
            if partial_clone:
                # For partial clones, use git.Git() with filter and sparse options
                cmd_args = ["--single-branch", "--no-checkout", "--depth=1"]
                cmd_args.extend(["--filter=blob:none", "--sparse"])
                cmd_args.extend([auth_url, local_path])
                git_cmd.clone(*cmd_args)
            elif token and is_github_host(url):
                # For authenticated GitHub repos, use git_cmd with auth URL
                cmd_args = ["--single-branch", "--no-checkout", "--depth=1"]
                cmd_args.extend([auth_url, local_path])
                git_cmd.clone(*cmd_args)
            else:
                # For non-authenticated repos, use the standard GitPython method
                # Security: disable git hooks to prevent malicious repos from running code
                clone_kwargs["multi_options"] = [
                    "-c core.hooksPath=/dev/null",
                ]
                clone_kwargs["allow_unsafe_options"] = True
                git.Repo.clone_from(url, local_path, **clone_kwargs)

        logger.info("Git clone completed successfully")
    except git.GitCommandError as exc:
        msg = f"Git clone failed: {exc}"
        raise RuntimeError(msg) from exc

    # Checkout the subpath if it is a partial clone
    if partial_clone:
        logger.info("Setting up partial clone for subpath", extra={"subpath": config.subpath})
        await checkout_partial_clone(config, token=token)
        logger.debug("Partial clone setup completed")

    # Perform post-clone operations
    await _perform_post_clone_operations(config, local_path, url, token, commit)

    logger.info("Git clone operation completed successfully", extra={"local_path": local_path})


async def _perform_post_clone_operations(
    config: CloneConfig,
    local_path: str,
    url: str,
    token: str | None,
    commit: str,
) -> None:
    """Perform post-clone operations like fetching, checkout, and submodule updates.

    Parameters
    ----------
    config : CloneConfig
        The configuration for cloning the repository.
    local_path : str
        The local path where the repository was cloned.
    url : str
        The repository URL.
    token : str | None
        GitHub personal access token (PAT) for accessing private repositories.
    commit : str
        The commit SHA to checkout.

    Raises
    ------
    RuntimeError
        If any Git operation fails.

    """
    try:
        repo = create_git_repo(local_path, url, token)

        # Ensure the commit is locally available
        logger.debug("Fetching specific commit", extra={"commit": commit})
        repo.git.fetch("--depth=1", "origin", commit)

        # Write the work-tree at that commit
        logger.info("Checking out commit", extra={"commit": commit})
        repo.git.checkout(commit)

        # Update submodules
        if config.include_submodules:
            logger.info("Updating submodules")
            repo.git.submodule("update", "--init", "--recursive", "--depth=1")
            logger.debug("Submodules updated successfully")
    except git.GitCommandError as exc:
        msg = f"Git operation failed: {exc}"
        raise RuntimeError(msg) from exc
