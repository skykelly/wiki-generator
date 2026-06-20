#!/usr/bin/env python3
"""
discover_sources.py — RSS 피드 자동 수집 → 스코어링 → ingest (멀티위키 지원)

표준 라이브러리 + openai만 사용.
점수 SCORE_THRESHOLD 이상이면 자동으로 /api/ingest 호출.

환경변수:
  INGEST_API_URL    배포 URL (예: https://wiki.example.com)
  INGEST_SECRET     Bearer 토큰
  OPENAI_API_KEY
  WIKI_ID           (선택) 특정 위키만 처리. 비우면 /api/wikis로 전체 목록 조회
  SCORE_THRESHOLD   (선택, 기본 6)
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from urllib.parse import quote

from openai import OpenAI

ITEMS_PER_FEED = 10
SCORE_THRESHOLD = int(os.environ.get("SCORE_THRESHOLD", "6"))
RATE_LIMIT_SEC = 1
USER_AGENT = "WikiGeneratorBot/1.0"

INGEST_API_URL = os.environ["INGEST_API_URL"].rstrip("/")
INGEST_SECRET = os.environ["INGEST_SECRET"]
WIKI_ID_ENV = os.environ.get("WIKI_ID", "").strip()

client = OpenAI()

# homestyle-wiki 기본 피드 (wiki_id가 없거나 wiki_homestyle일 때)
HOMESTYLE_FEEDS = [
    {"url": "https://blog.ohou.se/feed", "publisher": "오늘의집 블로그"},
    {"url": "https://www.kidp.or.kr/rss.do", "publisher": "한국디자인진흥원"},
    {"url": "https://www.seouldesign.or.kr/rss/news", "publisher": "서울디자인재단"},
    {"url": "https://rss.hankyung.com/economy/life.xml", "publisher": "한경 라이프"},
    {"url": "https://www.chosun.com/rss/life.xml", "publisher": "조선일보 라이프"},
]


def api_get(path: str) -> dict | list:
    req = urllib.request.Request(
        f"{INGEST_API_URL}{path}",
        headers={"User-Agent": USER_AGENT, "Authorization": f"Bearer {INGEST_SECRET}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.loads(res.read())
    except Exception as e:
        print(f"  [warn] API GET {path} 실패: {e}")
        return {}


def fetch(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


def parse_feed(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    items = []

    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if title and link:
            items.append({"title": title, "link": link})

    if items:
        return items

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    for entry in root.findall("atom:entry", ns):
        title = (entry.findtext("atom:title", namespaces=ns) or "").strip()
        link_el = entry.find("atom:link", ns)
        link = link_el.get("href", "").strip() if link_el is not None else ""
        if title and link:
            items.append({"title": title, "link": link})

    return items


def source_exists(url: str) -> bool:
    api_url = f"{INGEST_API_URL}/api/sources/exists?url={quote(url, safe='')}"
    try:
        data = json.loads(fetch(api_url))
        return bool(data.get("exists"))
    except Exception:
        return False


def score_item(title: str, topic: str) -> int:
    res = client.chat.completions.create(
        model="gpt-4.1-mini",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "위키 주제와 관련도를 0~10으로 평가. JSON: {\"score\": 숫자}"},
            {"role": "user", "content": f"위키 주제: {topic}\n기사 제목: {title}"},
        ],
    )
    data = json.loads(res.choices[0].message.content)
    return int(data.get("score", 0))


def fetch_content(url: str) -> str:
    return fetch(f"https://r.jina.ai/{url}", timeout=60).decode("utf-8", errors="ignore")


def ingest(title: str, raw_content: str, url: str, publisher: str, wiki_id: str) -> dict:
    payload = json.dumps({
        "title": title,
        "raw_content": raw_content,
        "url": url,
        "publisher": publisher,
        "source_type": "external",
        "wiki_id": wiki_id,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{INGEST_API_URL}/api/ingest",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {INGEST_SECRET}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read())


def process_wiki(wiki: dict) -> None:
    wiki_id = wiki.get("id", "wiki_homestyle")
    topic = wiki.get("topic") or wiki.get("title") or wiki_id
    print(f"\n{'='*60}")
    print(f"위키: {wiki.get('title', wiki_id)} ({wiki_id})")
    print(f"주제: {topic}")

    # RSS 피드 목록: scaffold_result에서 가져오거나 homestyle 기본값 사용
    scaffold = wiki.get("scaffold_result") or {}
    feeds = scaffold.get("suggested_rss_feeds") or []
    if not feeds and wiki_id == "wiki_homestyle":
        feeds = [{"url": f["url"], "label": f["publisher"]} for f in HOMESTYLE_FEEDS]

    if not feeds:
        print("  RSS 피드 없음, 스킵")
        return

    for feed in feeds:
        url = feed.get("url", "")
        label = feed.get("label") or feed.get("publisher") or url
        print(f"\n  피드: {label}")

        try:
            items = parse_feed(fetch(url))[:ITEMS_PER_FEED]
        except Exception as e:
            print(f"  [error] 피드 파싱 실패: {e}")
            continue

        print(f"  {len(items)}개 항목")

        for item in items:
            title, link = item["title"], item["link"]
            print(f"  - {title}")

            if source_exists(link):
                print("    이미 존재, 스킵")
                time.sleep(RATE_LIMIT_SEC)
                continue

            try:
                score = score_item(title, topic)
            except Exception as e:
                print(f"    [error] 스코어링 실패: {e}")
                time.sleep(RATE_LIMIT_SEC)
                continue

            print(f"    점수: {score}")
            if score < SCORE_THRESHOLD:
                print("    점수 미달, 스킵")
                time.sleep(RATE_LIMIT_SEC)
                continue

            try:
                raw_content = fetch_content(link)
                result = ingest(title, raw_content, link, label, wiki_id)
                print(f"    ✓ ingest 완료: {result.get('source_id')}")
            except Exception as e:
                print(f"    [error] ingest 실패: {e}")

            time.sleep(RATE_LIMIT_SEC)


def get_wikis() -> list[dict]:
    """활성화된 위키 목록을 API에서 가져옴."""
    data = api_get("/api/wikis")
    if isinstance(data, list):
        return [w for w in data if w.get("status") == "ready"]
    # fallback: homestyle only
    return [{"id": "wiki_homestyle", "title": "Homestyle Wiki", "topic": "홈스타일 인테리어", "status": "ready"}]


def main() -> None:
    if WIKI_ID_ENV:
        # 특정 위키만 처리
        wiki_data = api_get(f"/api/wikis/{WIKI_ID_ENV}")
        wikis = [wiki_data] if isinstance(wiki_data, dict) and wiki_data.get("id") else [
            {"id": WIKI_ID_ENV, "title": WIKI_ID_ENV, "topic": WIKI_ID_ENV, "status": "ready"}
        ]
    else:
        wikis = get_wikis()
        # homestyle은 항상 포함
        ids = {w.get("id") for w in wikis}
        if "wiki_homestyle" not in ids:
            wikis.insert(0, {
                "id": "wiki_homestyle",
                "title": "Homestyle Wiki",
                "topic": "홈스타일 인테리어",
                "status": "ready",
            })

    print(f"처리할 위키: {len(wikis)}개")
    for wiki in wikis:
        process_wiki(wiki)

    print("\n\n완료!")


if __name__ == "__main__":
    sys.exit(main())
