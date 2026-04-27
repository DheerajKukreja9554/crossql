"""Machine-key Fernet encryption for connection passwords.

Key derivation: PBKDF2(machine_node + username + salt) → Fernet key.
Passwords encrypted at rest in connections.yaml, decrypted in-memory only.
"""

from __future__ import annotations

import base64
import getpass
import hashlib
import logging
import platform

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_SALT = b"crossql-v1"
_ITERATIONS = 100_000


def get_machine_key() -> bytes:
    """Derive a Fernet key from machine identity (hostname + username)."""
    identity = f"{platform.node()}:{getpass.getuser()}".encode()
    dk = hashlib.pbkdf2_hmac("sha256", identity, _SALT, _ITERATIONS, dklen=32)
    return base64.urlsafe_b64encode(dk)


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string using the machine key. Returns base64 token."""
    f = Fernet(get_machine_key())
    return f.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a Fernet token. Raises InvalidToken if key doesn't match."""
    f = Fernet(get_machine_key())
    return f.decrypt(ciphertext.encode()).decode()


def is_encrypted(value: str) -> bool:
    """Check if a string looks like a Fernet token (starts with gAAAAA)."""
    return value.startswith("gAAAAA") and len(value) > 50
