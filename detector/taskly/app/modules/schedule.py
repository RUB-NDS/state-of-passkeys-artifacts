from typing import Iterable
from datetime import datetime
from tranco import Tranco
from crux_cache import CruxCache
from modules.configs import ScanConfigOrigin, TaskConfigOrigin, AnalysisConfigOrigin


def schedule_origin(scan_config: ScanConfigOrigin, task_config: TaskConfigOrigin) -> Iterable[AnalysisConfigOrigin]:
    if scan_config.type == "origin":
        yield AnalysisConfigOrigin(origin=scan_config.origin)

    elif scan_config.type == "crux":
        cache = CruxCache(cache_dir=".crux")
        for origin, rank in cache.get_dataset("global", month=scan_config.crux_yyyymm, max_rank=scan_config.max_rank):
            yield AnalysisConfigOrigin(origin=origin, rank=rank)

    elif scan_config.type == "tranco":
        tranco = Tranco(cache=True, cache_dir=".tranco")
        list = tranco.list(date=datetime.strptime(scan_config.tranco_yyyymmdd, "%Y%m%d").strftime("%Y-%m-%d"))
        for domain, rank in list.list.items():
            if scan_config.max_rank is not None and rank > scan_config.max_rank:
                continue
            yield AnalysisConfigOrigin(origin=f"https://{domain}", rank=rank)
