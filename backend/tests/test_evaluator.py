import pytest
from src.rules.evaluator import evaluate_expression, evaluate_field_access


def test_evaluate_expression_simple():
    assert evaluate_expression("1 < 2", {}) is True
    assert evaluate_expression("1 > 2", {}) is False
    assert evaluate_expression("x == 10", {"x": 10}) is True
    assert evaluate_expression("x != 10", {"x": 11}) is True
    assert evaluate_expression("amount > 1000", {"amount": 1500}) is True
    assert evaluate_expression("amount > 1000", {"amount": 500}) is False


def test_evaluate_expression_strings():
    assert evaluate_expression("status == 'approved'", {"status": "approved"}) is True
    assert evaluate_expression("role in ['admin','manager']", {"role": "admin"}) is True
    assert evaluate_expression("role in ['admin','manager']", {"role": "user"}) is False


def test_evaluate_expression_and_or():
    assert evaluate_expression("a and b", {"a": True, "b": True}) is True
    assert evaluate_expression("a and b", {"a": True, "b": False}) is False
    assert evaluate_expression("a or b", {"a": False, "b": True}) is True


def test_evaluate_expression_empty():
    assert evaluate_expression("", {}) is True
    assert evaluate_expression("   ", {}) is True


def test_evaluate_field_access():
    rules = [
        {"role_id": "admin", "expression": None, "permission": "write"},
        {"role_id": None, "expression": "amount > 1000", "permission": "read"},
    ]
    assert evaluate_field_access(rules, {"role_ids": ["admin"]}, "read") == "write"
    assert evaluate_field_access(rules, {"role_ids": ["user"], "amount": 1500}, "read") == "read"
    assert evaluate_field_access(rules, {"role_ids": ["user"], "amount": 500}, "read") == "read"
