"""VesselFinder.com 에서 선박 Length/Beam 크롤링.

원본: /Users/hjkim/KimHaejoong/008.부산항/crawling/vsfinder.py
변경점: print → logging, 모듈 import 시점에 세션 생성, 캐시 그대로 유지.
"""
from __future__ import annotations

import logging
import re
import time
from urllib.parse import quote_plus

import pandas as pd
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_session = requests.Session()
_session.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.vesselfinder.com/",
})

# 모듈 전역 캐시 (동일 선박 중복 요청 방지)
_dims_cache: dict[str, tuple[float | None, float | None]] = {}

_REQUEST_DELAY_SEC = 0.4  # API 부하 방지
_TIMEOUT = 15


def get_vessel_dimensions(name: str) -> tuple[float | None, float | None]:
    """VesselFinder 검색 결과에서 (Length, Beam) 추출.

    검색 실패 또는 파싱 실패 시 (None, None). 캐시 적용.
    """
    key = name.strip().lower()
    if key in _dims_cache:
        return _dims_cache[key]

    search_url = f"https://www.vesselfinder.com/vessels?name={quote_plus(name)}"

    try:
        response = _session.get(search_url, timeout=_TIMEOUT)
        response.raise_for_status()
    except requests.RequestException:
        logger.exception("VesselFinder 요청 실패: %s", name)
        _dims_cache[key] = (None, None)
        time.sleep(_REQUEST_DELAY_SEC)
        return (None, None)

    try:
        soup = BeautifulSoup(response.text, "html.parser")
        length: float | None = None
        beam: float | None = None

        # 검색 결과 테이블의 v6 클래스 셀에서 "Length / Beam" 추출
        for cell in soup.find_all("td", class_="v6"):
            text = cell.get_text(strip=True)
            m = re.search(r"(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)", text)
            if m:
                length = float(m.group(1))
                beam = float(m.group(2))
                break

        result = (length, beam)
        _dims_cache[key] = result
        return result
    except Exception:
        logger.exception("VesselFinder 응답 파싱 실패: %s", name)
        _dims_cache[key] = (None, None)
        return (None, None)
    finally:
        # API 부하 방지를 위한 딜레이
        time.sleep(_REQUEST_DELAY_SEC)


def enrich_with_length_beam(
    df: pd.DataFrame,
    ship_name_column: str = "선박명",
) -> pd.DataFrame:
    """DataFrame 에 Length(m)/Beam(m) 컬럼을 추가하여 반환."""
    out = df.copy()

    if ship_name_column not in out.columns:
        logger.warning("'%s' 컬럼 없음 — Length/Beam 추가 스킵", ship_name_column)
        out["Length(m)"] = None
        out["Beam(m)"] = None
        return out

    lengths: list[float | None] = []
    beams: list[float | None] = []
    failed_ships: list[str] = []
    total = len(out)

    for idx, ship_name in enumerate(out[ship_name_column].astype(str).fillna(""), 1):
        length, beam = get_vessel_dimensions(ship_name)
        lengths.append(length)
        beams.append(beam)
        if length is None or beam is None:
            failed_ships.append(ship_name)
        if idx % 10 == 0 or idx == total:
            logger.info("VesselFinder 진행: %d/%d", idx, total)

    if failed_ships:
        logger.info("VesselFinder 검색 실패 %d척: %s",
                    len(failed_ships), failed_ships[:10])

    out["Length(m)"] = lengths
    out["Beam(m)"] = beams
    return out
