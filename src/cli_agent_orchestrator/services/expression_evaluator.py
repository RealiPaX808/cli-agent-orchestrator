"""Expression evaluator for BPMN workflows with Jinja2 template support."""

import logging
import re
from typing import Any, Dict

from jinja2 import Environment, StrictUndefined, TemplateSyntaxError

logger = logging.getLogger(__name__)


class ExpressionEvaluator:
    def __init__(self):
        self.jinja_env = Environment(
            autoescape=False,
            undefined=StrictUndefined,
            trim_blocks=True,
            lstrip_blocks=True,
        )

        self.jinja_env.filters["default"] = lambda value, default="": (
            value if value is not None else default
        )

    def render_template(self, template: str, context: Dict[str, Any]) -> str:
        try:
            jinja_template = self.jinja_env.from_string(template)
            rendered = jinja_template.render(**context)
            return rendered
        except TemplateSyntaxError as e:
            logger.error(f"Template syntax error: {e}")
            raise ValueError(f"Invalid template: {e}")
        except Exception as e:
            logger.error(f"Template rendering error: {e}")
            raise ValueError(f"Template rendering failed: {e}")

    def evaluate(self, expression: str, context: Dict[str, Any]) -> Any:
        safe_context = self._create_safe_context(context)

        try:
            result = eval(expression, {"__builtins__": {}}, safe_context)
            return result
        except Exception as e:
            logger.error(f"Expression evaluation error: {expression} - {e}")
            raise ValueError(f"Invalid expression '{expression}': {e}")

    def _create_safe_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        safe_context = {}
        for key, value in context.items():
            if not callable(value):
                safe_context[key] = value
        return safe_context

    def evaluate_condition(self, condition: str, context: Dict[str, Any]) -> bool:
        result = self.evaluate(condition, context)
        return bool(result)
