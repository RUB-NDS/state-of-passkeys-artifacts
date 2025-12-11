#!/bin/bash

su -c "code tunnel --accept-server-license-terms &" jovyan
start-notebook.sh --NotebookApp.allow_origin="*" --NotebookApp.token="${ADMIN_PASS:-changeme}"
