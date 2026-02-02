"""
Выполнение Python-валидаторов проекта в песочнице (RestrictedPython).
Валидаторы: field_visibility (скрытие/доступ к полям), step_access (доступ к этапу).
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any

from RestrictedPython import compile_restricted, safe_globals
from RestrictedPython.Eval import default_guarded_getiter

logger = logging.getLogger(__name__)

_EXECUTOR = ThreadPoolExecutor(max_workers=4)
_TIMEOUT_SEC = 2

FIELD_VISIBILITY_TYPE = "field_visibility"
STEP_ACCESS_TYPE = "step_access"


def _get_restricted_globals(context: dict[str, Any], node_id: str | None) -> dict[str, Any]:
    """Globals для выполнения кода: только context, node_id и безопасные builtins."""
    g = dict(safe_globals)
    g["context"] = context
    g["node_id"] = node_id
    g["__builtins__"] = safe_globals.get("__builtins__", {})
    g["_getiter_"] = default_guarded_getiter
    g["__name__"] = "validator"
    return g


def _run_code(code: str, context: dict[str, Any], node_id: str | None) -> dict[str, Any]:
    """Компилирует и выполняет код в ограниченном globals. Возвращает globals после exec."""
    g = _get_restricted_globals(context, node_id)
    byte_code = compile_restricted(code, filename="<validator>", mode="exec")
    if byte_code.errors:
        raise SyntaxError("; ".join(err for err in byte_code.errors))
    exec(byte_code.code, g)
    return g


def run_field_visibility_validators(
    validators: list[Any],
    context: dict[str, Any],
) -> dict[str, str]:
    """
    Запускает все валидаторы типа field_visibility.
    context — плоский dict полей документа + role_ids и др.
    Возвращает dict: имя поля -> "hidden" | "read" | "write".
    При ошибке или таймауте валидатора — не меняем права (пустой dict или пропуск).
    """
    result: dict[str, str] = {}
    flat_ctx = dict(context)
    if "role_ids" not in flat_ctx:
        flat_ctx["role_ids"] = []

    for v in validators or []:
        if getattr(v, "type", None) != FIELD_VISIBILITY_TYPE:
            continue
        code = getattr(v, "code", "") or ""
        if not code.strip():
            continue
        try:
            out = _EXECUTOR.submit(
                _run_code,
                code,
                flat_ctx,
                None,
            ).result(timeout=_TIMEOUT_SEC)
            validate_fn = out.get("validate")
            if callable(validate_fn):
                perm_map = validate_fn(flat_ctx)
                if isinstance(perm_map, dict):
                    for key, val in perm_map.items():
                        if isinstance(key, str) and isinstance(val, str) and val in ("hidden", "read", "write"):
                            result[str(key)] = val
        except FuturesTimeoutError:
            logger.warning("Validator field_visibility timed out: %s", getattr(v, "name", "?"))
        except Exception as e:
            logger.warning("Validator field_visibility error: %s", e, exc_info=True)
    return result


def run_step_access_validators(
    validators: list[Any],
    context: dict[str, Any],
    node_id: str,
) -> bool:
    """
    Запускает все валидаторы типа step_access.
    Если хотя бы один вернул False или выбросил — доступ запрещён (False).
    При ошибке/таймауте — запрещаем доступ (безопасная сторона).
    """
    flat_ctx = dict(context)
    if "role_ids" not in flat_ctx:
        flat_ctx["role_ids"] = []

    for v in validators or []:
        if getattr(v, "type", None) != STEP_ACCESS_TYPE:
            continue
        code = getattr(v, "code", "") or ""
        if not code.strip():
            continue
        try:
            out = _EXECUTOR.submit(
                _run_code,
                code,
                flat_ctx,
                node_id,
            ).result(timeout=_TIMEOUT_SEC)
            validate_fn = out.get("validate")
            if callable(validate_fn):
                if not validate_fn(flat_ctx, node_id):
                    return False
            else:
                allowed = out.get("result", out.get("allowed", True))
                if not bool(allowed):
                    return False
        except FuturesTimeoutError:
            logger.warning("Validator step_access timed out: %s", getattr(v, "name", "?"))
            return False
        except Exception as e:
            logger.warning("Validator step_access error: %s", e, exc_info=True)
            return False
    return True
