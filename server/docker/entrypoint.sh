#!/bin/bash


set -e

# ./.venv/bin/pip install dist/*.whl
source ./.venv/bin/activate

if [[ $# -gt 0 ]]; then
    # If we pass a command, run it
    exec "$@"
else
    # Else default to starting the server
    exec server
fi