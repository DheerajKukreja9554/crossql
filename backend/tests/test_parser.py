"""Unit tests for the SQL parser. No database required."""

import pytest

from query.parser import ParseError, QueryPlan, parse_query

KNOWN_DBS = {"users_db", "orders_db"}


class TestSimpleQueries:
    def test_single_db_passthrough(self):
        sql = "SELECT * FROM users_db.users"
        plan = parse_query(sql, KNOWN_DBS)
        assert plan.is_single_db is True
        assert plan.referenced_dbs == {"users_db"}
        assert len(plan.sub_queries) == 1
        # db prefix stripped in passthrough SQL
        assert "users_db." not in plan.merge_sql

    def test_cross_db_join(self):
        sql = """
        SELECT u.name, o.total
        FROM users_db.users u
        JOIN orders_db.orders o ON u.id = o.user_id
        """
        plan = parse_query(sql, KNOWN_DBS)
        assert plan.is_single_db is False
        assert plan.referenced_dbs == {"users_db", "orders_db"}
        assert len(plan.sub_queries) == 2

        dbs = {sq.db_name for sq in plan.sub_queries}
        assert dbs == {"users_db", "orders_db"}

    def test_merge_sql_strips_db_prefix(self):
        sql = "SELECT u.name FROM users_db.users u JOIN orders_db.orders o ON u.id = o.user_id"
        plan = parse_query(sql, KNOWN_DBS)
        assert "users_db." not in plan.merge_sql
        assert "orders_db." not in plan.merge_sql

    def test_sub_queries_strip_db_prefix(self):
        sql = "SELECT u.name FROM users_db.users u JOIN orders_db.orders o ON u.id = o.user_id"
        plan = parse_query(sql, KNOWN_DBS)
        for sq in plan.sub_queries:
            assert f"{sq.db_name}." not in sq.sql


class TestPredicatePushdown:
    def test_single_db_predicate_pushed(self):
        sql = """
        SELECT u.name, o.total
        FROM users_db.users u
        JOIN orders_db.orders o ON u.id = o.user_id
        WHERE u.active = true
        """
        plan = parse_query(sql, KNOWN_DBS)
        users_sq = next(sq for sq in plan.sub_queries if sq.db_name == "users_db")
        assert "active" in users_sq.sql

    def test_cross_db_predicate_not_pushed(self):
        sql = """
        SELECT u.name, o.total
        FROM users_db.users u
        JOIN orders_db.orders o ON u.id = o.user_id
        WHERE u.id = o.user_id
        """
        plan = parse_query(sql, KNOWN_DBS)
        # Cross-DB condition should NOT be in any sub-query WHERE
        for sq in plan.sub_queries:
            assert "WHERE" not in sq.sql

    def test_each_db_gets_own_predicate(self):
        sql = """
        SELECT u.name, o.total
        FROM users_db.users u
        JOIN orders_db.orders o ON u.id = o.user_id
        WHERE u.active = true AND o.status = 'paid'
        """
        plan = parse_query(sql, KNOWN_DBS)
        users_sq = next(sq for sq in plan.sub_queries if sq.db_name == "users_db")
        orders_sq = next(sq for sq in plan.sub_queries if sq.db_name == "orders_db")
        assert "active" in users_sq.sql
        assert "status" in orders_sq.sql


class TestErrors:
    def test_unknown_db_prefix_raises(self):
        sql = "SELECT * FROM unknown_db.users u"
        with pytest.raises(ParseError, match="Unknown database"):
            parse_query(sql, KNOWN_DBS)

    def test_no_db_prefix_raises(self):
        sql = "SELECT * FROM users"
        with pytest.raises(ParseError):
            parse_query(sql, KNOWN_DBS)

    def test_unqualified_table_in_cross_db_raises(self):
        sql = "SELECT * FROM users_db.users u JOIN orders o ON u.id = o.user_id"
        with pytest.raises(ParseError, match="Unqualified table"):
            parse_query(sql, KNOWN_DBS)

    def test_invalid_sql_raises(self):
        with pytest.raises(ParseError, match="SQL syntax error"):
            parse_query("SELECT FROM WHERE", KNOWN_DBS)

    def test_no_tables_raises(self):
        with pytest.raises(ParseError):
            parse_query("SELECT 1", KNOWN_DBS)
