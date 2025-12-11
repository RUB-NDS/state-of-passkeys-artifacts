import os
import json
from uuid import uuid4
from pprint import pprint
from argdantic import ArgParser
from modules.tasks import load
from modules.lfs import store_in_filesystem


cli = ArgParser(force_group=True)


def execute(out, task_name, scan_id, task_id, start, scan_config, task_config, analysis_config):
    result = start(task_config, analysis_config)
    store_in_filesystem(out, task_name, scan_id, task_id, result)

    path = f"/{task_name}/{scan_id}/{task_id}"
    os.makedirs(f"{out}{path}", exist_ok=True)

    with open(f"{out}{path}/result.json", "w") as f:
        json.dump(result, f, indent=4)

    with open(f"{out}{path}/args.json", "w") as f:
        args = [task_name, scan_id, task_id, scan_config.model_dump(), task_config.model_dump(), analysis_config.model_dump()]
        json.dump(args, f, indent=4)

    print(f"{'#'*10} PATH {'#'*10}")
    print(f"{out}{path}")
    print()

    print(f"{'#'*10} ARGS {'#'*10}")
    pprint(args)
    print()

    print(f"{'#'*10} RESULT {'#'*10}")
    pprint(result)
    print()


def cmd_schedule(task_name, schedule, start, scan_config_class, task_config_class, analysis_config_class):
    def cmd(out: str = "/tmp", scan_config: scan_config_class = scan_config_class(), task_config: task_config_class = task_config_class(), analysis_config: analysis_config_class = analysis_config_class()):
        scan_id = str(uuid4())
        for analysis_config in list(schedule(scan_config, task_config)):
            task_id = str(uuid4())
            execute(out, task_name, scan_id, task_id, start, scan_config, task_config, analysis_config)
    return cmd


def cmd_start(task_name, schedule, start, scan_config_class, task_config_class, analysis_config_class):
    def cmd(out: str = "/tmp", scan_config: scan_config_class = scan_config_class(), task_config: task_config_class = task_config_class(), analysis_config: analysis_config_class = analysis_config_class()):
        scan_id = str(uuid4())
        task_id = str(uuid4())
        execute(out, task_name, scan_id, task_id, start, scan_config, task_config, analysis_config)
    return cmd


for (task_name, schedule, start, scan_config_class, task_config_class, analysis_config_class) in load():
    cli.command(name=f"schedule_{task_name}")(cmd_schedule(task_name, schedule, start, scan_config_class, task_config_class, analysis_config_class))
    cli.command(name=f"start_{task_name}")(cmd_start(task_name, schedule, start, scan_config_class, task_config_class, analysis_config_class))


if __name__ == "__main__":
    cli()
