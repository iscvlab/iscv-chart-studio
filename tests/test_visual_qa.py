import argparse
import os
import pathlib
import shutil
import sys
import tempfile
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True

ROOT = pathlib.Path(__file__).resolve().parent.parent
STUDIO_HTML = ROOT / "ui" / "studio.html"
INLINE_HTML = ROOT / "ui" / "inline.html"
DEFAULT_BRAIN_DIR = pathlib.Path(tempfile.gettempdir()) / "iscv-chart-studio-qa"

VIEWPORTS_6 = [
    (380, 720),
    (560, 800),
    (780, 860),
    (900, 900),
    (1280, 860),
    (1440, 900),
]

RESIZE_SWEEP = [
    (420, 800),
    (780, 860),
    (920, 860),
    (500, 760),
    (1300, 860),
]

TABS = [
    ("Charts", "#tabBtnCharts", "#tabCharts"),
    ("Data", "#tabBtnData", "#tabData"),
    ("Style", "#tabBtnStyle", "#tabStyle"),
]


def resolve_browser_executable() -> str | None:
    """Locate local Chrome first, falling back to Edge or system PATH."""
    candidates = [
        pathlib.Path(os.environ.get("PROGRAMFILES", r"C:\Program Files"))
        / "Google"
        / "Chrome"
        / "Application"
        / "chrome.exe",
        pathlib.Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)"))
        / "Microsoft"
        / "Edge"
        / "Application"
        / "msedge.exe",
        pathlib.Path(os.environ.get("PROGRAMFILES", r"C:\Program Files"))
        / "Microsoft"
        / "Edge"
        / "Application"
        / "msedge.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    for exe in ("chrome", "google-chrome", "msedge", "chromium"):
        hit = shutil.which(exe)
        if hit:
            return hit
    return None


def settle_layout(page, ms: int = 120) -> None:
    page.evaluate(
        "() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
    )
    page.wait_for_timeout(ms)


def assert_studio_invariants(page, context_label: str, expect_fit: bool = True) -> dict:
    """Assert viewport containment, SVG sizing, Light card rect, and zero stage scrollbars."""
    metrics = page.evaluate(
        """() => {
            const docEl = document.documentElement;
            const svg = document.querySelector('#svgHost svg');
            const stageVp = document.getElementById('stageViewport') || document.querySelector('.stage-viewport');
            const whiteRect = svg ? svg.querySelector('rect[fill="#FFFFFF"], rect[fill="#ffffff"]') : null;
            const rect = svg ? svg.getBoundingClientRect() : null;
            return {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                docScrollW: docEl.scrollWidth,
                docScrollH: docEl.scrollHeight,
                hasSvg: Boolean(svg),
                hasWhiteRect: Boolean(whiteRect),
                svgRect: rect ? {
                    top: rect.top,
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width,
                    height: rect.height
                } : null,
                hasStageVp: Boolean(stageVp),
                stageClientW: stageVp ? stageVp.clientWidth : null,
                stageClientH: stageVp ? stageVp.clientHeight : null,
                stageScrollW: stageVp ? stageVp.scrollWidth : null,
                stageScrollH: stageVp ? stageVp.scrollHeight : null,
                stageOverflow: stageVp ? getComputedStyle(stageVp).overflow : null
            };
        }"""
    )

    assert metrics["docScrollW"] <= metrics["innerWidth"] + 1, (
        f"[{context_label}] Horizontal document overflow: "
        f"scrollWidth={metrics['docScrollW']} > innerWidth={metrics['innerWidth']}"
    )
    assert metrics["docScrollH"] <= metrics["innerHeight"] + 1, (
        f"[{context_label}] Vertical document overflow: "
        f"scrollHeight={metrics['docScrollH']} > innerHeight={metrics['innerHeight']}"
    )
    assert metrics["hasSvg"], f"[{context_label}] Missing <svg> inside #svgHost"
    assert metrics["hasWhiteRect"], f"[{context_label}] Expected default Light card #FFFFFF rect in SVG"

    sr = metrics["svgRect"]
    assert sr["width"] >= 140 and sr["height"] >= 90, (
        f"[{context_label}] SVG collapsed below minimum (140x90): {sr}"
    )
    assert (
        sr["top"] >= -0.5
        and sr["left"] >= -0.5
        and sr["bottom"] <= metrics["innerHeight"] + 1
        and sr["right"] <= metrics["innerWidth"] + 1
    ), (
        f"[{context_label}] SVG clipped outside viewport ({metrics['innerWidth']}x{metrics['innerHeight']}): {sr}"
    )

    assert metrics["hasStageVp"], f"[{context_label}] Missing #stageViewport / .stage-viewport"
    if expect_fit:
        assert metrics["stageScrollH"] <= metrics["stageClientH"] + 1, (
            f"[{context_label}] Stage vertical scrollbar in Fit mode: "
            f"scrollH={metrics['stageScrollH']} > clientH={metrics['stageClientH']}"
        )
        assert metrics["stageScrollW"] <= metrics["stageClientW"] + 1, (
            f"[{context_label}] Stage horizontal scrollbar in Fit mode: "
            f"scrollW={metrics['stageScrollW']} > clientW={metrics['stageClientW']}"
        )
    return metrics


def assert_tab_body_reaches_last_item(page, selector: str, context_label: str) -> None:
    """Verify .tab-body can scroll to the very last item and keep it inside .tab-body."""
    res = page.evaluate(
        """(sel) => {
            const body = document.querySelector('.tab-body');
            const items = Array.from(document.querySelectorAll(sel));
            const last = items[items.length - 1];
            if (!body || !last) return { ok: false, reason: 'missing body or item', count: items.length };
            last.scrollIntoView({ block: 'end' });
            const bRect = body.getBoundingClientRect();
            const lRect = last.getBoundingClientRect();
            return {
                ok: true,
                count: items.length,
                scrollTop: body.scrollTop,
                scrollHeight: body.scrollHeight,
                clientHeight: body.clientHeight,
                insideBody: lRect.top >= bRect.top - 2 && lRect.bottom <= bRect.bottom + 2,
                insideViewport: lRect.top >= 0 && lRect.bottom <= window.innerHeight + 1,
                bRect: { top: bRect.top, bottom: bRect.bottom },
                lRect: { top: lRect.top, bottom: lRect.bottom }
            };
        }""",
        selector,
    )
    assert res["ok"], f"[{context_label}] {res}"
    assert res["scrollHeight"] > res["clientHeight"], (
        f"[{context_label}] Expected .tab-body to overflow and scroll for {selector}: {res}"
    )
    assert res["scrollTop"] > 0, f"[{context_label}] .tab-body failed to scroll down: {res}"
    assert res["insideBody"] and res["insideViewport"], (
        f"[{context_label}] Last item {selector} not reachable inside .tab-body/viewport: {res}"
    )
    page.evaluate("() => { const b = document.querySelector('.tab-body'); if (b) b.scrollTop = 0; }")


def assert_inline_invariants(page, context_label: str) -> dict:
    metrics = page.evaluate(
        """() => {
            const docEl = document.documentElement;
            const svg = document.querySelector('#svgHost svg');
            const whiteRect = svg ? svg.querySelector('rect[fill="#FFFFFF"], rect[fill="#ffffff"]') : null;
            const rect = svg ? svg.getBoundingClientRect() : null;
            return {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                docScrollW: docEl.scrollWidth,
                docScrollH: docEl.scrollHeight,
                hasSvg: Boolean(svg),
                hasWhiteRect: Boolean(whiteRect),
                svgRect: rect ? {
                    top: rect.top,
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width,
                    height: rect.height
                } : null
            };
        }"""
    )
    assert metrics["docScrollW"] <= metrics["innerWidth"] + 1, (
        f"[{context_label}] Inline horizontal overflow: {metrics}"
    )
    assert metrics["hasSvg"], f"[{context_label}] Inline missing <svg>"
    assert metrics["hasWhiteRect"], f"[{context_label}] Inline missing Light card #FFFFFF rect"
    sr = metrics["svgRect"]
    assert sr["width"] >= 140 and sr["height"] >= 90, (
        f"[{context_label}] Inline SVG collapsed: {sr}"
    )
    assert (
        sr["top"] >= -0.5
        and sr["left"] >= -0.5
        and sr["right"] <= metrics["innerWidth"] + 1
        and sr["bottom"] <= metrics["innerHeight"] + 1
    ), f"[{context_label}] Inline SVG clipped outside viewport: {metrics}"
    return metrics


def run_qa(screenshot_dir: pathlib.Path) -> None:
    if not STUDIO_HTML.is_file() or not INLINE_HTML.is_file():
        raise FileNotFoundError(
            f"Built HTML files missing. Run `npm run build` first: {STUDIO_HTML}, {INLINE_HTML}"
        )

    screenshot_dir.mkdir(parents=True, exist_ok=True)
    exe_path = resolve_browser_executable()
    launch_kwargs = {"headless": True, "args": ["--no-sandbox", "--disable-gpu"]}
    if exe_path:
        launch_kwargs["executable_path"] = exe_path

    console_errors: list[str] = []
    page_errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kwargs)
        try:
            # ------------------------------------------------------------------
            # 1. Studio 6-Viewport x 3-Tab Matrix + Narrow Scroll Reachability
            # ------------------------------------------------------------------
            context = browser.new_context(
                viewport={"width": 1280, "height": 860},
                device_scale_factor=2,
            )
            page = context.new_page()
            page.on(
                "console",
                lambda msg: console_errors.append(msg.text)
                if msg.type == "error"
                else None,
            )
            page.on("pageerror", lambda err: page_errors.append(str(err)))

            page.goto(STUDIO_HTML.as_uri(), wait_until="load")
            settle_layout(page)

            for w, h in VIEWPORTS_6:
                page.set_viewport_size({"width": w, "height": h})
                settle_layout(page)
                for tab_name, btn_sel, pane_sel in TABS:
                    page.click(btn_sel)
                    settle_layout(page, 90)
                    assert page.is_visible(pane_sel), f"Tab {tab_name} pane not visible"
                    assert_studio_invariants(page, f"matrix {w}x{h} {tab_name}")

                    if (w, h) in ((380, 720), (560, 800)):
                        if tab_name == "Charts":
                            assert_tab_body_reaches_last_item(
                                page, ".chart-card", f"narrow-scroll {w}x{h} Charts"
                            )
                        elif tab_name == "Style":
                            assert_tab_body_reaches_last_item(
                                page, ".palette-btn", f"narrow-scroll {w}x{h} Style"
                            )
                            if (w, h) == (380, 720):
                                page.screenshot(
                                    path=str(screenshot_dir / "qa_narrow_style.png"),
                                    full_page=True,
                                )

                    if (w, h) == (1280, 860) and tab_name == "Data":
                        page.screenshot(
                            path=str(screenshot_dir / "qa_desktop_data_1280.png"),
                            full_page=True,
                        )

            # ------------------------------------------------------------------
            # 2. Dynamic Resize Sweep (single page, no reload) across Charts & Style
            # ------------------------------------------------------------------
            for w, h in RESIZE_SWEEP:
                page.set_viewport_size({"width": w, "height": h})
                settle_layout(page)
                for tab_name, btn_sel, _ in (TABS[0], TABS[2]):
                    page.click(btn_sel)
                    settle_layout(page, 90)
                    assert_studio_invariants(page, f"sweep {w}x{h} {tab_name}")
                    if (w, h) == (920, 860) and tab_name == "Charts":
                        page.screenshot(
                            path=str(screenshot_dir / "qa_wide_charts_920.png"),
                            full_page=True,
                        )

            # ------------------------------------------------------------------
            # 3. Interactive Behaviors (Fresh Page at 1280x860 & 780x860)
            # ------------------------------------------------------------------
            page.set_viewport_size({"width": 1280, "height": 860})
            page.click("#tabBtnCharts")
            settle_layout(page)

            # 3a. Inspector Collapse / Expand (Hide Panel -> Show Panel)
            before_collapse = assert_studio_invariants(page, "before-hide-panel")
            hide_btn = page.locator("button", has_text="Hide Panel")
            assert hide_btn.count() == 1, "Expected 'Hide Panel' button"
            hide_btn.click()
            settle_layout(page)
            show_btn = page.locator("button", has_text="Show Panel")
            assert show_btn.count() == 1, "Expected button to toggle to 'Show Panel'"
            assert not page.is_visible(".left-pane"), ".left-pane must hide when collapsed"
            collapsed_metrics = assert_studio_invariants(page, "inspector-collapsed")
            assert collapsed_metrics["svgRect"]["width"] > before_collapse["svgRect"]["width"] + 40, (
                f"Expected SVG width to expand on collapse: before={before_collapse['svgRect']['width']} "
                f"collapsed={collapsed_metrics['svgRect']['width']}"
            )
            show_btn.click()
            settle_layout(page)
            assert page.is_visible(".left-pane"), ".left-pane must reappear after 'Show Panel'"
            assert_studio_invariants(page, "after-show-panel")

            # 3b. Zoom 100% -> Fit at tight viewport (560x800) where 680x440 requires scaling
            page.set_viewport_size({"width": 560, "height": 800})
            settle_layout(page)
            zoom_100 = page.locator("#btnZoom100")
            zoom_fit = page.locator("#btnZoomFit")
            assert zoom_100.count() == 1 and zoom_fit.count() == 1, "Missing #btnZoom100 / #btnZoomFit zoom buttons"
            zoom_100.click()
            settle_layout(page)
            manual_state = page.evaluate(
                """() => {
                    const vp = document.getElementById('stageViewport') || document.querySelector('.stage-viewport');
                    const fr = document.getElementById('stageFrame') || document.querySelector('.stage-frame');
                    return {
                        overflow: vp ? getComputedStyle(vp).overflow : null,
                        frameW: fr ? fr.getBoundingClientRect().width : null,
                        frameH: fr ? fr.getBoundingClientRect().height : null,
                        scrollW: vp ? vp.scrollWidth : null,
                        clientW: vp ? vp.clientWidth : null
                    };
                }"""
            )
            assert manual_state["frameW"] >= 675, (
                f"Expected 100% zoom to size stageFrame to ~680px: {manual_state}"
            )
            zoom_fit.click()
            settle_layout(page)
            assert_studio_invariants(page, "zoom-restored-fit", expect_fit=True)

            # 3c. Verify all 45 icon tiles, multi-column grid, and scrollTop preservation
            page.set_viewport_size({"width": 900, "height": 900})
            page.click("#tabBtnCharts")
            settle_layout(page)
            icon_audit = page.evaluate(
                """() => {
                    const cards = Array.from(document.querySelectorAll('#chartList .chart-card'));
                    const svgs = cards.filter(c => c.querySelector('.chart-card-icon svg[viewBox="0 0 18 18"]'));
                    const topRows = new Set(cards.slice(0, 6).map(c => Math.round(c.getBoundingClientRect().top)));
                    return { total: cards.length, withSvg: svgs.length, colsApprox: cards.slice(0, 6).length / Math.max(1, topRows.size), firstRowYCount: cards.filter(c => Math.abs(c.getBoundingClientRect().top - cards[0].getBoundingClientRect().top) < 4).length };
                }"""
            )
            assert icon_audit["total"] == 45 and icon_audit["withSvg"] == 45, (
                f"Expected 45 chart icon tiles with 18x18 SVGs, got: {icon_audit}"
            )
            assert icon_audit["firstRowYCount"] >= 2, (
                f"Expected multi-column chart icon grid on 900x900, got: {icon_audit}"
            )

            card_45 = page.locator(".chart-card").nth(44)
            assert card_45.count() == 1, "Expected 45 chart cards"
            assert card_45.get_attribute("data-chart-id") == "correlation_matrix", (
                f"45th chart card should have data-chart-id=correlation_matrix, got: {card_45.get_attribute('data-chart-id')}"
            )
            card_45.scroll_into_view_if_needed()
            settle_layout(page, 60)
            scroll_before_card = page.eval_on_selector(".tab-body", "el => el.scrollTop")
            assert scroll_before_card > 20, (
                f"Expected .tab-body to be scrolled to 45th card, got scrollTop={scroll_before_card}"
            )
            card_45.click()
            settle_layout(page, 100)
            scroll_after_card = page.eval_on_selector(".tab-body", "el => el.scrollTop")
            assert abs(scroll_after_card - scroll_before_card) <= 5 and scroll_after_card > 0, (
                f".tab-body.scrollTop jumped on chart card click: before={scroll_before_card}, after={scroll_after_card}"
            )
            assert "correlation_matrix" in page.inner_text("#topMeta"), (
                "Chart did not switch to correlation_matrix on 45th card click"
            )

            # Narrow 640px Charts icon grid screenshot & multi-column check
            page.set_viewport_size({"width": 640, "height": 820})
            page.click("#tabBtnCharts")
            settle_layout(page)
            narrow_cols = page.evaluate(
                """() => {
                    const cards = Array.from(document.querySelectorAll('#chartList .chart-card'));
                    const y0 = cards[0].getBoundingClientRect().top;
                    return cards.filter(c => Math.abs(c.getBoundingClientRect().top - y0) < 4).length;
                }"""
            )
            assert narrow_cols >= 3, f"Expected >= 3 icon tile columns at 640px width, got {narrow_cols}"
            page.screenshot(
                path=str(screenshot_dir / "qa_narrow_charts_640.png"),
                full_page=True,
            )

            # 3d. Clicking 14th palette (bivariate_iscv_tealamber) preserves .tab-body.scrollTop
            page.click("#tabBtnStyle")
            settle_layout(page)
            pal_14 = page.locator(".palette-btn").nth(13)
            assert pal_14.count() == 1, "Expected 14 palette buttons"
            pal_14_text = pal_14.inner_text()
            assert "Teal-Amber" in pal_14_text, (
                f"14th palette should be Bivariate 3x3: ISCV Teal-Amber, got: {pal_14_text}"
            )
            pal_14.scroll_into_view_if_needed()
            settle_layout(page, 60)
            scroll_before_pal = page.eval_on_selector(".tab-body", "el => el.scrollTop")
            assert scroll_before_pal > 20, (
                f"Expected .tab-body to be scrolled to 14th palette, got scrollTop={scroll_before_pal}"
            )
            pal_14.click()
            settle_layout(page, 100)
            scroll_after_pal = page.eval_on_selector(".tab-body", "el => el.scrollTop")
            assert abs(scroll_after_pal - scroll_before_pal) <= 5 and scroll_after_pal > 0, (
                f".tab-body.scrollTop jumped on palette click: before={scroll_before_pal}, after={scroll_after_pal}"
            )
            assert "active" in (pal_14.get_attribute("class") or ""), (
                "14th palette button did not become active after click"
            )
            context.close()

            # ------------------------------------------------------------------
            # 4. Inline HTML at (640, 700) and (420, 700)
            # ------------------------------------------------------------------
            inline_ctx = browser.new_context(
                viewport={"width": 640, "height": 700},
                device_scale_factor=2,
            )
            inline_page = inline_ctx.new_page()
            inline_page.on(
                "console",
                lambda msg: console_errors.append(msg.text)
                if msg.type == "error"
                else None,
            )
            inline_page.on("pageerror", lambda err: page_errors.append(str(err)))
            inline_page.goto(INLINE_HTML.as_uri(), wait_until="load")
            settle_layout(inline_page)
            assert_inline_invariants(inline_page, "inline 640x700")
            inline_page.screenshot(
                path=str(screenshot_dir / "qa_inline_640.png"),
                full_page=True,
            )

            # Verify Inline visual icon picker popover opens 45 tiles and switches chart
            inline_page.click("#btnChartPicker")
            settle_layout(inline_page, 100)
            pop_audit = inline_page.evaluate(
                """() => {
                    const pop = document.getElementById('chartPopover');
                    const tiles = Array.from(document.querySelectorAll('#inlineChartGrid .inline-chart-tile'));
                    const svgs = tiles.filter(t => t.querySelector('.inline-tile-icon svg[viewBox="0 0 18 18"]'));
                    return {
                        visible: Boolean(pop && !pop.hidden),
                        tiles: tiles.length,
                        svgs: svgs.length,
                        docScrollH: document.documentElement.scrollHeight,
                        innerH: window.innerHeight
                    };
                }"""
            )
            assert pop_audit["visible"] and pop_audit["tiles"] == 45 and pop_audit["svgs"] == 45, (
                f"Inline chart popover failed 45-icon audit: {pop_audit}"
            )
            inline_page.screenshot(
                path=str(screenshot_dir / "qa_inline_picker_640.png"),
                full_page=True,
            )
            inline_page.locator('#inlineChartGrid .inline-chart-tile[data-chart-id="sankey_flow"]').click()
            settle_layout(inline_page, 100)
            assert inline_page.evaluate("() => document.getElementById('chartPopover').hidden"), (
                "Inline chart popover should close after selecting a chart tile"
            )
            assert "sankey_flow" in inline_page.inner_text("#metaBadge"), (
                "Inline chart did not switch to sankey_flow after clicking icon tile"
            )

            inline_page.set_viewport_size({"width": 420, "height": 700})
            settle_layout(inline_page)
            assert_inline_invariants(inline_page, "inline 420x700")
            inline_ctx.close()
        finally:
            browser.close()

    assert not console_errors, f"Console errors encountered: {console_errors}"
    assert not page_errors, f"Uncaught page errors encountered: {page_errors}"
    print(
        f"PASS: Visual QA passed across 6 viewports x 3 tabs, 5-step resize sweep, "
        f"interactive controls, and inline.html (0 errors). Screenshots -> {screenshot_dir}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="ISCV Chart Studio Playwright Visual QA")
    parser.add_argument(
        "--screenshot-dir",
        default=os.environ.get("ISCV_QA_SCREENSHOT_DIR", str(DEFAULT_BRAIN_DIR)),
        help="Directory for saving the QA screenshots",
    )
    args = parser.parse_args()
    run_qa(pathlib.Path(args.screenshot_dir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
