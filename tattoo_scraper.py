import os
import time
import requests
import random
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# --- CONFIGURATION ---
MONGO_URI = "mongodb+srv://Jordon:Password123@inkspace.aswtppt.mongodb.net/?appName=InkSpace"
DATABASE_NAME = "test"
UPLOADS_FOLDER = r"C:\Users\Jordon\tattoo-finder-backend\uploads"
FIREFOX_PROFILE_PATH = r"C:\Users\Jordon\AppData\Roaming\Mozilla\Firefox\Profiles\p9m02w6j.default"
SITE_PASSWORD_HASH = "$2b$10$CgCk39Tdsks7CROdUTe9IuY/VKmcnPGEgEgRxNxqz4gyw1PHg.Uh6"

USER_START = datetime(2026, 2, 15, 0, 0)
USER_END = datetime(2026, 2, 28, 15, 0)
POST_START = datetime(2026, 2, 1, 0, 0)
POST_END = datetime(2026, 2, 14, 23, 0)

def get_random_date(start_date, end_date):
    delta = end_date - start_date
    int_delta = (delta.days * 24 * 60 * 60) + delta.seconds
    random_second = random.randrange(int_delta)
    date_obj = start_date + timedelta(seconds=random_second)
    return {"$date": date_obj.strftime('%Y-%m-%dT%H:%M:%S.000Z')}

def generate_ordered_dates(count, start_date, end_date):
    delta = end_date - start_date
    total_seconds = int(delta.total_seconds())
    step = total_seconds // (count + 1)
    dates = []
    for i in range(1, count + 1):
        date_obj = end_date - timedelta(seconds=step * i)
        dates.append({"$date": date_obj.strftime('%Y-%m-%dT%H:%M:%S.000Z')})
    return dates

def get_profile_pic_url(driver):
    try:
        img_src = driver.execute_script("""
            const mainEl = document.querySelector('main');
            if (!mainEl) return null;
            const imgs = Array.from(mainEl.querySelectorAll('header img'));
            if (imgs.length === 0) return null;
            imgs.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
            return imgs[0].src;
        """)
        return img_src
    except Exception as e:
        print(f"  ⚠️ Could not get profile pic: {e}")
        return None

def get_full_bio(driver):
    try:
        driver.execute_script("""
            const main = document.querySelector('main');
            if (!main) return;
            const header = main.querySelector('header');
            if (!header) return;
            const allEls = Array.from(header.querySelectorAll('span, button, div'));
            for (const el of allEls) {
                const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
                if (text === 'more' || text === '... more' || text === '…more' || text === 'more...') {
                    el.click();
                    break;
                }
            }
        """)
        time.sleep(1)
        bio = driver.execute_script("""
            const main = document.querySelector('main');
            if (!main) return '';
            const header = main.querySelector('header');
            if (!header) return '';

            const spans = Array.from(header.querySelectorAll('span'))
                .filter(s => {
                    const text = s.innerText.trim();
                    if (text.length === 0) return false;
                    if (text.toLowerCase().startsWith('followed by')) return false;
                    if (/^\\d+(\\.\\d+)?[km]?$/.test(text.toLowerCase())) return false;
                    if (/^\\d+ (posts|followers|following)$/i.test(text)) return false;
                    return true;
                });

            if (spans.length === 0) return '';

            const bioSpans = spans
                .map(s => ({ el: s, top: s.getBoundingClientRect().top }))
                .filter(s => s.top > 140 && s.top < 250)
                .sort((a, b) => a.top - b.top);

            if (bioSpans.length === 0) return '';

            return bioSpans[0].el.innerText.trim();
        """)
        return bio or ""
    except Exception as e:
        print(f"  ⚠️ Could not get bio: {e}")
        return ""

def collect_grid_links(driver, target_count):
    print(f"  📡 Phase 1: Scrolling down to depth for {target_count} posts...")

    rows_needed = (target_count // 3) + 1
    target_scroll_px = rows_needed * 300

    scroll_chunk = 600
    scrolled = 0
    while scrolled < target_scroll_px:
        driver.execute_script(f"window.scrollBy(0, {scroll_chunk});")
        time.sleep(1.5)
        scrolled += scroll_chunk

    print(f"  📡 Phase 2: Scrolling back to top...")
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(3)

    print(f"  📡 Phase 3: Collecting all visible post links via JS...")
    links_data = driver.execute_script("""
        const mainEl = document.querySelector('main');
        if (!mainEl) return [];
        const mainRect = mainEl.getBoundingClientRect();
        const allLinks = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
        const results = [];
        const seen = new Set();
        for (const link of allLinks) {
            const href = link.href;
            if (seen.has(href)) continue;
            const rect = link.getBoundingClientRect();
            if (rect.width < 50 || rect.height < 50) continue;
            if (rect.left < mainRect.left - 50) continue;
            seen.add(href);
            results.push({
                href: href,
                y: window.scrollY + rect.top,
                x: rect.left
            });
        }
        results.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
        return results.map(r => r.href);
    """)

    print(f"  ✅ Collected {len(links_data)} post URLs from grid.")

    print(f"  🗺️  Grid map (first 10 slots):")
    for i, link in enumerate(links_data[:10]):
        print(f"      Slot {i+1} → {link}")

    if len(links_data) < target_count:
        print(f"  ⚠️ Only got {len(links_data)}, need {target_count}. Doing a second scroll pass...")
        seen = set(links_data)
        extra_rows = ((target_count - len(links_data)) // 3) + 2
        for i in range(extra_rows):
            driver.execute_script("window.scrollBy(0, 600);")
            time.sleep(2)
            new_links = driver.execute_script("""
                const allLinks = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
                const results = [];
                for (const link of allLinks) {
                    const rect = link.getBoundingClientRect();
                    if (rect.width < 50 || rect.height < 50) continue;
                    results.push({
                        href: link.href,
                        y: window.scrollY + rect.top,
                        x: rect.left
                    });
                }
                results.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
                return results.map(r => r.href);
            """)
            for href in new_links:
                if href not in seen:
                    seen.add(href)
                    links_data.append(href)
            if len(links_data) >= target_count:
                break
        print(f"  ✅ After second pass: {len(links_data)} total URLs.")

    return links_data

def scrape_post_image_url(driver, expected_url):
    try:
        WebDriverWait(driver, 15).until(
            lambda d: expected_url.split('?')[0].rstrip('/') in d.current_url
        )

        time.sleep(4)

        img_url = driver.execute_script("""
            const searchRoot = document.querySelector('div[role="dialog"]') || document;

            const video = searchRoot.querySelector('video[poster]');
            if (video && video.poster) return video.poster;

            const imgs = Array.from(searchRoot.querySelectorAll('img'));
            const candidates = imgs.filter(img => {
                const rect = img.getBoundingClientRect();
                return rect.width > 200 && rect.height > 200;
            });

            if (candidates.length === 0) return null;

            candidates.sort((a, b) => {
                return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
            });

            const best = candidates[0];
            if (best.srcset) {
                const parts = best.srcset.split(',').map(s => s.trim());
                const last = parts[parts.length - 1];
                return last.split(' ')[0];
            }
            return best.src;
        """)

        if img_url:
            print(f"    🖼️  Found image: {img_url[:80]}...")
        return img_url

    except Exception as e:
        print(f"  ❌ Failed to get post image: {e}")
        return None

def run_mega_import(shop_un, artists_dict):
    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]

    options = Options()
    options.add_argument("-profile")
    options.add_argument(FIREFOX_PROFILE_PATH)
    driver = webdriver.Firefox(
        service=Service(GeckoDriverManager().install()),
        options=options
    )
    driver.maximize_window()

    try:
        # =====================================================================
        # --- 1. ONBOARD SHOP ---
        # =====================================================================
        print(f"\n🏪 Onboarding Shop: {shop_un}")
        driver.get(f"https://www.instagram.com/{shop_un}/")
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "main header"))
        )
        time.sleep(5)

        shop_bio = get_full_bio(driver)
        shop_pp_url = get_profile_pic_url(driver)

        print(f"  📝 Shop bio: {shop_bio[:120]}")

        shop_pp_name = f"pp-shop-{int(time.time())}.jpg"
        if shop_pp_url:
            with open(os.path.join(UPLOADS_FOLDER, shop_pp_name), 'wb') as f:
                f.write(requests.get(shop_pp_url).content)
            print(f"  ✅ Shop profile pic saved.")
        else:
            print(f"  ⚠️ Could not get shop profile pic.")

        shop_id = db.users.insert_one({
            "email": f"{shop_un}@example.com",
            "password": SITE_PASSWORD_HASH,
            "username": shop_un,
            "profilePic": f"uploads/{shop_pp_name}",
            "userType": "shop",
            "followers": [], "following": [], "savedPosts": [],
            "__t": "Shop",
            "bio": shop_bio,
            "location": "Oakland",
            "artists": [],
            "createdAt": get_random_date(USER_START, USER_END),
            "__v": 0
        }).inserted_id
        print(f"  ✅ Shop '{shop_un}' inserted with ID: {shop_id}")

        # =====================================================================
        # --- 2. ONBOARD ARTISTS ---
        # =====================================================================
        for artist_un, indices in artists_dict.items():
            print(f"\n👤 Artist: {artist_un} | Slots: {indices}")

            driver.get(f"https://www.instagram.com/{artist_un}/")
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "main header"))
            )
            time.sleep(5)

            art_bio = get_full_bio(driver)
            art_pp_url = get_profile_pic_url(driver)

            print(f"  📝 Bio: {art_bio[:120]}")

            art_pp_name = f"pp-art-{int(time.time())}-{artist_un}.jpg"
            if art_pp_url:
                with open(os.path.join(UPLOADS_FOLDER, art_pp_name), 'wb') as f:
                    f.write(requests.get(art_pp_url).content)
                print(f"  ✅ Artist profile pic saved.")
            else:
                print(f"  ⚠️ Could not get artist profile pic.")

            artist_id = db.users.insert_one({
                "email": f"{artist_un}@example.com",
                "password": SITE_PASSWORD_HASH,
                "username": artist_un,
                "profilePic": f"uploads/{art_pp_name}",
                "userType": "artist",
                "followers": [], "following": [], "savedPosts": [],
                "__t": "Artist",
                "bio": art_bio,
                "location": "Oakland",
                "shop": shop_id,
                "createdAt": get_random_date(USER_START, USER_END),
                "__v": 0
            }).inserted_id

            db.users.update_one({"_id": shop_id}, {"$push": {"artists": artist_id}})
            print(f"  ✅ Artist '{artist_un}' inserted with ID: {artist_id}")

            target_count = max(indices)
            all_links = collect_grid_links(driver, target_count)

            if len(all_links) < target_count:
                print(f"  ⚠️ WARNING: Only captured {len(all_links)} links, need up to {target_count}.")

            sorted_indices = sorted(indices)
            ordered_dates = generate_ordered_dates(len(sorted_indices), POST_START, POST_END)
            date_map = {idx: ordered_dates[i] for i, idx in enumerate(sorted_indices)}

            for idx in sorted_indices:
                zero_idx = idx - 1

                if zero_idx >= len(all_links):
                    print(f"  ⏭️ Skipping slot {idx}: only {len(all_links)} captured.")
                    continue

                target_url = all_links[zero_idx]
                print(f"  📸 Scraping slot {idx} → {target_url}")

                driver.get(target_url)
                img_url = scrape_post_image_url(driver, target_url)

                if not img_url:
                    print(f"  ❌ No image found for slot {idx}, skipping.")
                    continue

                fname = f"post-{int(time.time() * 1000)}-{artist_un}-{idx}.jpg"
                try:
                    with open(os.path.join(UPLOADS_FOLDER, fname), 'wb') as f:
                        f.write(requests.get(img_url).content)
                    db.posts.insert_one({
                        "user": artist_id,
                        "image": f"uploads/{fname}",
                        "caption": "",
                        "tags": [],
                        "colorType": "",
                        "flashOrCustom": "",
                        "size": "",
                        "foundationalStyles": [],
                        "techniques": [],
                        "subjects": [],
                        "likes": [],
                        "comments": [],
                        "createdAt": date_map[idx],
                        "__v": 0
                    })
                    print(f"  ✅ Saved slot {idx} → {fname}")
                except Exception as e:
                    print(f"  ❌ Failed to save slot {idx}: {e}")

                time.sleep(random.uniform(2, 4))

            print(f"  ✅ Done with {artist_un}.")

    finally:
        print("\n🔒 Closing browser...")
        driver.quit()
        client.close()
        print("✅ Import complete.")


# --- RUN ---
run_mega_import(
    "amor_eterno_arte",
    {
        "chamuco510":     [],
	"corazonquebrado":     [],
	"shishi.madriz":     [],
	"randydoestattoos":     [],
	"pablito510art":     [],
	"missymuerte":     [],
	"pacogarciajr":     [],
    }
)