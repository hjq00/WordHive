import json, zlib, base64, os

OUT = r"E:/workbuddy工作区/背单词软件/design"
os.makedirs(OUT, exist_ok=True)

W = 412
GAP = 492


def it(id, kind, label, icon=None, variant="filled", **kw):
    d = {"id": id, "kind": kind, "label": label, "icon": icon, "variant": variant}
    d.update(kw)
    return d


def nav(x, y, selected, actions):
    tabs = [
        ("home", "学习"),
        ("refresh", "复习"),
        ("auto_stories", "素材"),
        ("auto_awesome", "AI"),
        ("person", "我的"),
    ]
    return {
        "id": f"nav{selected}",
        "x": x,
        "y": y,
        "axis": "x",
        "items": [
            it(
                f"nav{selected}",
                "bottomNav",
                "",
                None,
                tabs=[{"icon": i, "label": l} for i, l in tabs],
                selected=selected,
                actions=actions,
            )
        ],
    }


def g(id, x, y, items, axis="x"):
    return {"id": id, "x": x, "y": y, "axis": axis, "items": items}


frames = [
    {"id": "study", "name": "学习 · 滑动词卡", "x": 0, "y": 0,
     "note": "一屏一词，上下滑动切换；停留时长自动判定掌握程度，右上角可收藏。",
     "swipe": {"left": "detail"}},
    {"id": "detail", "name": "词卡详解", "x": GAP, "y": 0, "length": 1000,
     "note": "底部抽屉展开的完整信息：释义、联想、真题例句、词根词缀、派生与近反义词。"},
    {"id": "review", "name": "复习 · 记忆曲线", "x": GAP * 2, "y": 0,
     "note": "按到期时间排序的复习队列，可切换到收藏与已掌握。"},
    {"id": "library", "name": "素材 · 真题与美剧", "x": GAP * 3, "y": 0,
     "note": "真题阅读、听力、长难句、美剧四类语境素材。"},
    {"id": "ai", "name": "AI · 定制阅读", "x": GAP * 4, "y": 0,
     "note": "选择主题、难度与目标词，生成定制阅读；也可把陌生词串成故事。"},
    {"id": "me", "name": "我的 · 设置", "x": GAP * 5, "y": 0,
     "note": "打卡统计、每日新词、复习提醒与停留判定灵敏度。"},
]

groups = []

# ---------------- 学习 ----------------
x = 0
groups += [
    g("s_bar", x, 0, [it("s_bar_i", "topAppBar", "学习", None, icon2="star",
                          note="右上角收藏当前单词")]),
    g("s_meta", x + 20, 100, [it("s_meta_t", "text", "今日 12 / 20 · 考研核心", None, size=14)]),
    g("s_prog", x + 20, 128, [it("s_prog_i", "linearProgress", "", None, value=60)]),
    g("s_word", x + 20, 168, [it("s_word_t", "text", "abandon", None, size=46, bold=True)]),
    g("s_ph", x + 20, 236, [it("s_ph_t", "text", "/əˈbændən/   v. 放弃；抛弃", None, size=15)]),
    g("s_mne", x + 20, 280, [it("s_mne_c", "card", "联想 · 拆分", "lightbulb",
                                variant="tonal", noImage=True, size=372, size2=118,
                                supporting="a + band + on：乐队散了，成员各自散去。",
                                note="点按可切换谐音、词根等其它联想方式")]),
    g("s_ex", x + 20, 424, [it("s_ex_t", "text", "The firm abandoned its plan to expand.", None, size=16)]),
    g("s_exzh", x + 20, 456, [it("s_exzh_t", "text", "公司放弃了扩张计划。", None, size=13)]),
    g("s_chips", x + 20, 502, [
        it("s_c1", "chip", "真题 2019", None),
        it("s_c2", "chip", "词根", None),
        it("s_c3", "chip", "近义词", None),
        it("s_c4", "chip", "收藏", "star", checked=False),
    ]),
    g("s_dwell", x + 20, 552, [it("s_dwell_c", "chip", "停留 2.4s · 判定：模糊", "timer", checked=True,
                                  note="右侧环形进度显示停留时长：1.6 秒内划过记认识，超过 5 秒或展开详解记不认识")]),
    g("s_hint", x + 20, 700, [it("s_hint_t", "text", "上滑切换下一个 · 停留即记录", None, size=12)]),
    nav(x, 788, 0, {"tab:1": {"to": "review", "transition": "fade"},
                    "tab:2": {"to": "library", "transition": "fade"},
                    "tab:3": {"to": "ai", "transition": "fade"},
                    "tab:4": {"to": "me", "transition": "fade"}}),
]

# ---------------- 详解 ----------------
x = GAP
groups += [
    g("d_bar", x, 0, [it("d_bar_i", "topAppBar", "abandon", "arrow_back", icon2="star",
                          actions={"icon": {"to": "back", "transition": "slide"}})]),
    g("d_def", x + 20, 104, [it("d_def_c", "card", "释义", None,
                                variant="filled", noImage=True, size=372, size2=108,
                                supporting="v. 放弃（计划、主张）；抛弃 · 中止，停止")]),
    g("d_mne", x + 20, 228, [it("d_mne_c", "card", "联想记忆 · 谐音", "lightbulb",
                                variant="tonal", noImage=True, size=372, size2=118,
                                supporting="“啊，板凳”：一屁股坐回板凳，彻底放弃挣扎。")]),
    g("d_real", x + 20, 362, [it("d_real_c", "card", "真题例句 · 2019 英语一 Text 1", None,
                                 variant="outlined", noImage=True, size=372, size2=140,
                                 supporting="Many scientists have abandoned the assumption that human behaviour can be fully explained by economic incentives.")]),
    g("d_root", x + 20, 518, [it("d_root_c", "card", "词根词缀", None,
                                variant="filled", noImage=True, size=372, size2=118,
                                supporting="a-（加强） + band（束缚） + -on → 解除束缚，放手不管")]),
    g("d_tags", x + 20, 656, [
        it("d_t1", "chip", "abandonment", None),
        it("d_t2", "chip", "desert", None),
        it("d_t3", "chip", "forsake", None),
        it("d_t4", "chip", "retain", None),
    ]),
    g("d_tag_lbl", x + 20, 700, [it("d_tag_lbl_t", "text", "派生词 · 近义词 · 反义词", None, size=12)]),
    g("d_btn", x + 20, 744, [it("d_btn_i", "button", "收藏这个词", "star", variant="outlined",
                                size=372, toggle={"icon": "star", "variant": "filled", "label": "已收藏"})]),
]

# ---------------- 复习 ----------------
x = GAP * 2
groups += [
    g("r_bar", x, 0, [it("r_bar_i", "topAppBar", "复习", None)]),
    g("r_box", x + 20, 100, [it("r_box_i", "box", "", None, size=372, size2=184,
                                fill="primaryContainer", radiusTop=20, radiusBottom=20)]),
    g("r_k", x + 36, 116, [it("r_k_t", "text", "今天待复习", None, size=13)]),
    g("r_big", x + 36, 140, [it("r_big_t", "text", "28 词", None, size=44, bold=True)]),
    g("r_sub", x + 36, 200, [it("r_sub_t", "text", "逾期 6 · 今天到期 22", None, size=13)]),
    g("r_btn", x + 36, 228, [it("r_btn_i", "button", "开始复习", "play_arrow", size=180,
                                action={"to": "study", "transition": "slide"})]),
    g("r_mk", x + 20, 304, [it("r_mk_t", "text", "掌握程度", None, size=14)]),
    g("r_mbar", x + 20, 330, [it("r_mbar_i", "linearProgress", "", None, value=42, wavy=True, trackThickness=12)]),
    g("r_legend", x + 20, 362, [
        it("r_l1", "chip", "已掌握 12", None),
        it("r_l2", "chip", "复习中 30", None),
        it("r_l3", "chip", "学习中 18", None),
    ]),
    g("r_tabs", x + 20, 414, [it("r_tabs_i", "tabs", "", None,
                                 tabs=[{"label": "待复习"}, {"label": "收藏"}, {"label": "已掌握"}],
                                 selected=0)]),
    g("r_list", x + 20, 474, [
        it("r_i1", "listItem", "abandon", "menu_book", icon2="chevron_right",
           supporting="逾期 2 天 · 上次 6 天前", action={"to": "detail", "transition": "slide"}),
        it("r_i2", "listItem", "ambiguous", "menu_book", icon2="chevron_right",
           supporting="今天到期 · 第 3 次复习", action={"to": "detail", "transition": "slide"}),
        it("r_i3", "listItem", "coherent", "menu_book", icon2="chevron_right",
           supporting="今天到期 · 第 2 次复习"),
        it("r_i4", "listItem", "constrain", "menu_book", icon2="chevron_right",
           supporting="明天到期 · 间隔 4 天"),
    ], axis="y"),
    nav(x, 788, 1, {"tab:0": {"to": "study", "transition": "fade"},
                    "tab:2": {"to": "library", "transition": "fade"},
                    "tab:3": {"to": "ai", "transition": "fade"},
                    "tab:4": {"to": "me", "transition": "fade"}}),
]

# ---------------- 素材 ----------------
x = GAP * 3
groups += [
    g("l_bar", x, 0, [it("l_bar_i", "topAppBar", "素材", None)]),
    g("l_tabs", x, 88, [it("l_tabs_i", "tabs", "", None,
                           tabs=[{"label": "真题阅读"}, {"label": "听力"}, {"label": "长难句"}, {"label": "美剧"}],
                           selected=0)]),
    g("l_c1", x + 20, 152, [it("l_c1_i", "card", "Why We Forget What We Learn", None,
                               noImage=True, size=372, size2=148,
                               supporting="考研英语一 · 6 分钟 · 8 个生词")]),
    g("l_c2", x + 20, 316, [it("l_c2_i", "card", "The Cost of Constant Connection", None,
                               noImage=True, size=372, size2=148,
                               supporting="六级 · 5 分钟 · 6 个生词")]),
    g("l_lbl", x + 20, 488, [it("l_lbl_t", "text", "按主题筛选", None, size=14)]),
    g("l_chips", x + 20, 514, [
        it("l_ch1", "chip", "教育", None),
        it("l_ch2", "chip", "科技", None),
        it("l_ch3", "chip", "环境", None),
        it("l_ch4", "chip", "经济", None),
        it("l_ch5", "chip", "社会", None),
    ]),
    g("l_c3", x + 20, 566, [it("l_c3_i", "card", "美剧原声 · Modern Family", "play_circle",
                               noImage=True, size=372, size2=128,
                               supporting="3 个场景 · 连读提示 · GitHub 看剧工具")]),
    nav(x, 788, 2, {"tab:0": {"to": "study", "transition": "fade"},
                    "tab:1": {"to": "review", "transition": "fade"},
                    "tab:3": {"to": "ai", "transition": "fade"},
                    "tab:4": {"to": "me", "transition": "fade"}}),
]

# ---------------- AI ----------------
x = GAP * 4
groups += [
    g("a_bar", x, 0, [it("a_bar_i", "topAppBar", "AI 学习", None)]),
    g("a_tabs", x, 88, [it("a_tabs_i", "tabs", "", None,
                           tabs=[{"label": "定制阅读"}, {"label": "串词成文"}],
                           selected=0)]),
    g("a_topic", x + 20, 152, [it("a_topic_i", "select", "主题", None,
                                  tabs=[{"label": "科技"}, {"label": "教育"}, {"label": "环境"}, {"label": "经济"}],
                                  selected=1)]),
    g("a_level", x + 20, 224, [it("a_level_i", "select", "难度", None,
                                  tabs=[{"label": "基础"}, {"label": "进阶"}, {"label": "冲刺"}],
                                  selected=1)]),
    g("a_field", x + 20, 296, [it("a_field_i", "textField", "目标词",
                                  variant="outlined", icon=None,
                                  supporting="留空则自动使用今日生词与收藏词")]),
    g("a_btn", x + 20, 372, [it("a_btn_i", "button", "生成一篇阅读", "auto_awesome", size=372)]),
    g("a_lbl", x + 20, 452, [it("a_lbl_t", "text", "最近生成", None, size=14)]),
    g("a_out", x + 20, 478, [it("a_out_i", "card", "The Quiet Cost of Speed", None,
                                noImage=True, size=372, size2=158,
                                supporting="12 个目标词 · 320 词 · 逐句译文")]),
    g("a_story", x + 20, 654, [it("a_story_i", "card", "把陌生词串成故事", None,
                                  noImage=True, size=372, size2=118,
                                  supporting="选 6 个生词，生成一段可读的小故事")]),
    nav(x, 788, 3, {"tab:0": {"to": "study", "transition": "fade"},
                    "tab:1": {"to": "review", "transition": "fade"},
                    "tab:2": {"to": "library", "transition": "fade"},
                    "tab:4": {"to": "me", "transition": "fade"}}),
]

# ---------------- 我的 ----------------
x = GAP * 5
groups += [
    g("m_bar", x, 0, [it("m_bar_i", "topAppBar", "我的", None)]),
    g("m_box", x + 20, 100, [it("m_box_i", "box", "", None, size=372, size2=140,
                                fill="primaryContainer", radiusTop=20, radiusBottom=20)]),
    g("m_k", x + 36, 116, [it("m_k_t", "text", "连续打卡", None, size=13)]),
    g("m_big", x + 36, 138, [it("m_big_t", "text", "12 天", None, size=40, bold=True)]),
    g("m_sub", x + 36, 196, [it("m_sub_t", "text", "本周 168 词 · 累计 1,240 词", None, size=12)]),
    g("m_list", x + 20, 262, [
        it("m_1", "listItem", "每日新词", "tune", supporting="20 个"),
        it("m_2", "listItem", "复习提醒", "notifications", supporting="每天 20:00"),
        it("m_3", "listItem", "停留判定", "timer", supporting="标准 · 1.6s / 5s"),
        it("m_4", "listItem", "深色模式", "dark_mode", switch=True, checked=False),
        it("m_5", "listItem", "词书管理", "menu_book", supporting="考研英语 · 核心"),
        it("m_6", "listItem", "数据与备份", "download", supporting="导出 / 导入"),
    ], axis="y"),
    nav(x, 788, 4, {"tab:0": {"to": "study", "transition": "fade"},
                    "tab:1": {"to": "review", "transition": "fade"},
                    "tab:2": {"to": "library", "transition": "fade"},
                    "tab:3": {"to": "ai", "transition": "fade"}}),
]

doc = {
    "title": "轻词 · 考研 / 六级背单词",
    "brief": "一屏一词的轻量背词器：滑动切换、停留时长自动判定掌握度、按记忆曲线安排复习。",
    "frame": "phone",
    "platform": "android",
    "paletteKey": "teal",
    "theme": {"dark": False, "bothModes": True, "contrast": "standard",
              "shape": "rounded", "font": "system", "emphasized": False, "motion": "expressive"},
    "frames": frames,
    "groups": groups,
}

path = os.path.join(OUT, "m3e-canvas.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)

raw = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
c = zlib.compressobj(9, zlib.DEFLATED, -15)
packed = c.compress(raw) + c.flush()
frag = base64.urlsafe_b64encode(packed).decode().rstrip("=")

with open(os.path.join(OUT, "share-link.txt"), "w", encoding="utf-8") as f:
    f.write("http://localhost:3000/#docz=" + frag + "\n")
    f.write("https://lnkiai.github.io/m3e-canvas/#docz=" + frag + "\n")

print("bytes", len(raw), "frag", len(frag))
print("LOCAL  http://localhost:3000/#docz=" + frag)
print("HOSTED https://lnkiai.github.io/m3e-canvas/#docz=" + frag)
