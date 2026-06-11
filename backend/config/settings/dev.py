from .base import *  # noqa: F403

DEBUG = True

ALLOWED_HOSTS = ["*"]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:\d+$",
    r"^http://127\.0\.0\.1:\d+$",
    r"^http://10\.\d+\.\d+\.\d+:\d+$",
    r"^http://192\.168\.\d+\.\d+:\d+$",
    r"^http://172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+:\d+$",
]
