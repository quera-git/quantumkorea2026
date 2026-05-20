"""부산항 BPTC(신선대감만터미널) 선석배정 현황 크롤러.

원본: /Users/hjkim/KimHaejoong/008.부산항/crawling/bpt.py
변경점: print → logging, 함수 시그니처 유지, Excel/CLI 코드 제거.

외부 호출 함수는 try/except + logging 으로 감쌌다 (AGENTS.md §4.5).
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime

import pandas as pd
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_TIMEOUT = 15  # seconds

# BPTC 사이트 form 의 v_time 라디오 값 (사이트 HTML 발췌 기준)
TIME_PRESETS = ("3days", "week", "month", "term")


def get_berth_status(
    time: str = "3days",
    route: str = "ALL",
    berth: str = "A",
    start_date: date | None = None,
    end_date: date | None = None,
) -> pd.DataFrame:
    """신선대감만터미널 선석배정 현황 조회.

    Args:
        time: 조회기간 — "3days"(4일) / "week" / "month" / "term"(직접입력).
        route: 항로구분 (기본 "ALL")
        berth: 선석구분 — A(전체) / S(신선대) / G(감만). 기본 "A".
        start_date: time="term" 일 때 시작일.
        end_date: time="term" 일 때 종료일.

    Returns:
        DataFrame. 사이트 응답 실패 또는 테이블 없음 시 빈 DataFrame.

    Raises:
        ValueError: time="term" 인데 start_date/end_date 누락하거나, 시작>종료.
    """
    url = "https://info.bptc.co.kr/Berth_status_text_servlet_sw_kr"
    payload: dict[str, str] = {
        "v_time": time,
        "ROCD": route,
        "v_oper_cd": "",
        "ORDER": "item1",
        "v_gu": berth,
    }

    if time == "term":
        if start_date is None or end_date is None:
            raise ValueError("time='term' 시 start_date 와 end_date 가 모두 필요합니다.")
        if start_date > end_date:
            raise ValueError(
                f"start_date({start_date}) 가 end_date({end_date}) 보다 늦습니다."
            )
        payload.update({
            "YEAR1": f"{start_date.year:04d}",
            "MONTH1": f"{start_date.month:02d}",
            "DAY1": f"{start_date.day:02d}",
            "YEAR2": f"{end_date.year:04d}",
            "MONTH2": f"{end_date.month:02d}",
            "DAY2": f"{end_date.day:02d}",
        })
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": (
            "https://info.bptc.co.kr/content/sw/frame/berth_status_text_frame_sw_kr.jsp"
            "?p_id=BETX_SH_KR&snb_num=2&snb_div=service"
        ),
    }

    try:
        res = requests.post(url, data=payload, headers=headers, timeout=_TIMEOUT)
        res.raise_for_status()
    except requests.RequestException:
        logger.exception("BPTC 선석배정 현황 요청 실패")
        return pd.DataFrame()

    res.encoding = "euc-kr"
    soup = BeautifulSoup(res.text, "html.parser")
    table = soup.find("table")
    if not table:
        logger.warning("BPTC 응답에 테이블 없음")
        return pd.DataFrame()

    headers_list = [th.get_text(strip=True) for th in table.find_all("th")]
    rows = []
    for tr in table.find_all("tr")[1:]:
        cols = [td.get_text(strip=True) for td in tr.find_all("td")]
        if cols:
            rows.append(cols)

    df = pd.DataFrame(rows, columns=headers_list)
    logger.info("BPTC 선석배정: %d건 조회", len(df))
    return df


def get_all_bp_data(date: str | None = None) -> dict[tuple[str, str], str]:
    """한 번의 요청으로 모든 BP(Bitt) 데이터를 사전으로 가져온다.

    Args:
        date: 조회 날짜(YYYY-MM-DD). None 이면 오늘.

    Returns:
        {(ship_cd, call_no): bitt_str} 사전. 실패 시 빈 사전.
    """
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    url = "https://info.bptc.co.kr/content/sw/jsp/berth_g_sw_kr.jsp"
    params = {
        "p_id": "BEGR_SH_KR",
        "snb_num": "2",
        "pop_ok": "Y",
        "PAR": "",
        "v_dt": date,
        "sub": "+%C8%AE+%C0%CE+",  # '조회' URL 인코딩
    }
    headers = {
        "Referer": (
            "https://info.bptc.co.kr/content/sw/frame/berth_g_frame_sw_kr.jsp"
            "?p_id=BEGR_SH_KR&snb_num=2&snb_div=service"
        ),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    try:
        res = requests.get(url, params=params, headers=headers, timeout=_TIMEOUT)
        res.raise_for_status()
    except requests.RequestException:
        logger.exception("BPTC BP 요청 실패")
        return {}

    res.encoding = "euc-kr"
    soup = BeautifulSoup(res.text, "html.parser")

    bp_dict: dict[tuple[str, str], str] = {}
    layer1_sections = soup.find_all("section", id="layer1")
    if not layer1_sections:
        logger.warning("BPTC BP 응답에 layer1 없음")
        return bp_dict

    pattern = re.compile(
        r"VslMsg\('([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)',"
        r"'([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'\)"
    )

    for layer1 in layer1_sections:
        for a_tag in layer1.find_all("a"):
            href = a_tag.get("href", "")
            m = pattern.search(href)
            if not m:
                continue
            ship_cd = m.group(2)
            call_no = m.group(4)
            bitt = m.group(11)
            bp_dict[(ship_cd, call_no)] = bitt

    logger.info("BPTC BP 데이터: %d 척", len(bp_dict))
    return bp_dict


def parse_bp(bp_str: str | None) -> tuple[int | None, int | None, int | None]:
    """BP 문자열을 (bp, f, e) 정수 튜플로 파싱.

    예: "110 ( F: 1, E: 142)" → (110, 1, 142)
    실패 시 (None, None, None).
    """
    if not bp_str or pd.isna(bp_str):
        return (None, None, None)

    m = re.search(r"(\d+)\s*\(\s*F:\s*(\d+)\s*,\s*E:\s*(\d+)\)", bp_str)
    if not m:
        return (None, None, None)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)))


def _extract_eta_dates(df: pd.DataFrame) -> list[str]:
    """DataFrame 의 '입항 예정일시' 컬럼에서 unique YYYY-MM-DD 일자를 뽑는다.

    BPTC 의 선석 그래픽 페이지는 v_dt=하루치 만 반환하므로, 조회 결과에 여러
    날짜의 선박이 섞여 있으면 각 일자에 대해 BP 호출이 필요하다.
    """
    if "입항 예정일시" not in df.columns:
        return []
    dates: set[str] = set()
    for s in df["입항 예정일시"]:
        if not isinstance(s, str) or len(s) < 10:
            continue
        # "YYYY/MM/DD HH:MM" → "YYYY-MM-DD"
        dates.add(s[:10].replace("/", "-"))
    return sorted(dates)


def add_bp_to_dataframe(df: pd.DataFrame, date: str | None = None) -> pd.DataFrame:
    """DataFrame 의 '모선항차' 컬럼을 기반으로 bp/f/e 컬럼을 추가한다.

    date 가 None 이면 DataFrame 의 ETA 일자 set 을 뽑아 각 일자별로 BP 페이지를
    조회한 뒤 dict 를 합친다. 사이트의 BP 그래픽은 v_dt=하루치 만 보여주므로,
    조회 기간이 여러 날에 걸치거나 오늘이 아닐 때 매칭 누락이 발생한다.

    DataFrame 에 '모선항차' 컬럼이 없으면 원본을 그대로 반환.
    """
    if "모선항차" not in df.columns:
        logger.warning("DataFrame 에 '모선항차' 컬럼 없음 — bp 추가 스킵")
        return df

    if date is not None:
        bp_dict = get_all_bp_data(date)
    else:
        eta_dates = _extract_eta_dates(df) or [None]
        bp_dict: dict[tuple[str, str], str] = {}
        for d in eta_dates:
            bp_dict.update(get_all_bp_data(d))
        logger.info("BP 다일자 조회: %s → 누적 %d 척", eta_dates, len(bp_dict))

    bp_list, f_list, e_list = [], [], []
    failed_ships: list[str] = []

    for _, row in df.iterrows():
        mocen = str(row["모선항차"]) if pd.notna(row["모선항차"]) else ""
        parts = mocen.split("-")
        if len(parts) >= 2:
            ship_cd, call_no = parts[0], parts[1]
            bp_str = bp_dict.get((ship_cd, call_no))
            bp, f, e = parse_bp(bp_str)
            bp_list.append(bp)
            f_list.append(f)
            e_list.append(e)
            if bp is None and f is None and e is None:
                failed_ships.append(mocen)
        else:
            logger.warning("모선항차 형식 비정상: %s", mocen)
            failed_ships.append(mocen)
            bp_list.append(None)
            f_list.append(None)
            e_list.append(None)

    if failed_ships:
        logger.info("BP 조회 실패 %d척: %s", len(failed_ships), failed_ships[:10])

    df = df.copy()
    df["bp"] = bp_list
    df["f"] = f_list
    df["e"] = e_list
    return df
