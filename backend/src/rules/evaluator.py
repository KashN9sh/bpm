"""
Минимальный безопасный вычислитель выражений для условий переходов и видимости полей.
Поддерживает: сравнения (==, !=, <, <=, >, >=), in, and, or, скобки, доступ к полям контекста.
Без eval/exec — только разбор простых выражений.
"""
from __future__ import annotations

from typing import Any


def _tokenize(s: str) -> list[str]:
    s = s.strip()
    if not s:
        return []
    tokens = []
    i = 0
    while i < len(s):
        if s[i].isspace():
            i += 1
            continue
        if s[i] in "()[]":
            tokens.append(s[i])
            i += 1
            continue
        if s[i] == ",":
            tokens.append(",")
            i += 1
            continue
        if s[i:i + 2] in ("==", "!=", "<=", ">="):
            tokens.append(s[i:i + 2])
            i += 2
            continue
        if s[i] in "<>":
            tokens.append(s[i])
            i += 1
            continue
        if s[i:i + 2].lower() == "in":
            tokens.append("in")
            i += 2
            continue
        if s[i:i + 3].lower() == "and":
            tokens.append("and")
            i += 3
            continue
        if s[i:i + 2].lower() == "or":
            tokens.append("or")
            i += 2
            continue
        if s[i] in ("'", '"'):
            q = s[i]
            j = i + 1
            while j < len(s) and s[j] != q:
                if s[j] == "\\":
                    j += 1
                j += 1
            tokens.append(s[i : j + 1])
            i = j + 1
            continue
        if s[i].isdigit() or (s[i] == "." and i + 1 < len(s) and s[i + 1].isdigit()):
            j = i
            while j < len(s) and (s[j].isdigit() or s[j] == "."):
                j += 1
            tokens.append(s[i:j])
            i = j
            continue
        if s[i].isalpha() or s[i] == "_":
            j = i
            while j < len(s) and (s[j].isalnum() or s[j] == "_" or s[j] == "."):
                j += 1
            tokens.append(s[i:j])
            i = j
            continue
        i += 1
    return tokens


def _parse_primary(tokens: list[str], pos: int, context: dict[str, Any]) -> tuple[Any, int]:
    if pos >= len(tokens):
        raise ValueError("Unexpected end")
    t = tokens[pos]
    if t == "(":
        val, pos = _parse_or(tokens, pos + 1, context)
        if pos >= len(tokens) or tokens[pos] != ")":
            raise ValueError("Missing )")
        return val, pos + 1
    if t == "[":
        pos += 1
        lst: list[Any] = []
        while pos < len(tokens) and tokens[pos] != "]":
            item, pos = _parse_primary(tokens, pos, context)
            lst.append(item)
            if pos < len(tokens) and tokens[pos] == ",":
                pos += 1
        if pos >= len(tokens) or tokens[pos] != "]":
            raise ValueError("Missing ]")
        return lst, pos + 1
    if t and (t[0] in "'\"" or t.isdigit() or (len(t) > 1 and t[0] == ".")):
        if t[0] in "'\"":
            return t[1:-1].replace("\\'", "'").replace('\\"', '"'), pos + 1
        if "." in t:
            return float(t), pos + 1
        return int(t), pos + 1
    if t.lower() in ("true", "yes"):
        return True, pos + 1
    if t.lower() in ("false", "no"):
        return False, pos + 1
    if t and (t[0].isalpha() or t[0] == "_"):
        parts = t.split(".")
        obj: Any = context
        for p in parts:
            if isinstance(obj, dict) and p in obj:
                obj = obj[p]
            else:
                return None, pos + 1
        return obj, pos + 1
    raise ValueError(f"Unexpected token: {t}")


def _parse_comparison(tokens: list[str], pos: int, context: dict[str, Any]) -> tuple[Any, int]:
    left, pos = _parse_primary(tokens, pos, context)
    if pos < len(tokens) and tokens[pos] in ("==", "!=", "<", "<=", ">", ">="):
        op = tokens[pos]
        pos += 1
        right, pos = _parse_primary(tokens, pos, context)
        if op == "==":
            left = left == right
        elif op == "!=":
            left = left != right
        elif op == "<":
            left = (left is not None and right is not None) and left < right
        elif op == "<=":
            left = (left is not None and right is not None) and left <= right
        elif op == ">":
            left = (left is not None and right is not None) and left > right
        elif op == ">=":
            left = (left is not None and right is not None) and left >= right
    elif pos < len(tokens) and tokens[pos].lower() == "in":
        pos += 1
        right, pos = _parse_primary(tokens, pos, context)
        left = left in right if isinstance(right, (list, tuple, str)) else False
    return left, pos


def _parse_and(tokens: list[str], pos: int, context: dict[str, Any]) -> tuple[Any, int]:
    left, pos = _parse_comparison(tokens, pos, context)
    while pos < len(tokens) and tokens[pos].lower() == "and":
        pos += 1
        right, pos = _parse_comparison(tokens, pos, context)
        left = bool(left) and bool(right)
    return left, pos


def _parse_or(tokens: list[str], pos: int, context: dict[str, Any]) -> tuple[Any, int]:
    left, pos = _parse_and(tokens, pos, context)
    while pos < len(tokens) and tokens[pos].lower() == "or":
        pos += 1
        right, pos = _parse_and(tokens, pos, context)
        left = bool(left) or bool(right)
    return left, pos


def evaluate_expression(expression: str, context: dict[str, Any]) -> bool:
    """
    Вычисляет выражение в контексте. Возвращает bool.
    Примеры: "amount > 1000", "status == 'approved'", "role in ['admin','manager']"
    """
    if not expression or not expression.strip():
        return True
    tokens = _tokenize(expression.strip())
    if not tokens:
        return True
    try:
        result, pos = _parse_or(tokens, 0, context)
        if pos != len(tokens):
            return False
        return bool(result)
    except (ValueError, KeyError, TypeError):
        return False


def evaluate_field_access(
    access_rules: list[dict],
    context: dict[str, Any],
    default_permission: str = "read",
) -> str:
    """
    По списку правил доступа (role_id, expression, permission) и контексту
    (в т.ч. role_ids пользователя) возвращает итоговое право: read, write, hidden.
    Первое подходящее правило побеждает.
    """
    for rule in access_rules or []:
        role_id = rule.get("role_id")
        expression = rule.get("expression")
        permission = rule.get("permission", "read")
        if role_id and "role_ids" in context:
            if role_id in context.get("role_ids", []):
                return permission
        if expression:
            if evaluate_expression(expression, context):
                return permission
    return default_permission
