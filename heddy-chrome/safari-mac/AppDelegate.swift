//
//  AppDelegate.swift — Heddy for Safari, macOS app 1.1: Heddy in the Mac menu bar (aitutors.me PRD-v0.145.0, S2).
//
//  scripts/package-safari-app.sh copies this file over the converter's "macOS (App)/AppDelegate.swift", so it is the
//  ONE checked-in source of the Mac app's own behaviour (no Xcode project edits). The converter's window ("Turn on
//  Heddy in Safari", Shared (App)/ViewController.swift) is kept as it is.
//
//  What it does (owner rulings M1–M12):
//    * M1   an owl in the menu bar (NSStatusItem); the number beside it is her open to-dos.
//    * M2   clicking it drops an NSPopover with the T1 "Night sky" panel, navy and gold, drawn in SwiftUI.
//    * M3–M10 the week line, ‹ Today › with the My calendar button, the 3/5 check-in ring, seven day stamps, the
//           TODAY and TO-DO boxes, ONE Tonight's line row (Heddy's eyes + a line + "+2"), the shortcuts.
//    * M11  first launch: a welcome sheet with "Open Heddy when I log in" ticked (SMAppService.mainApp) and Start.
//    * M12  Dock icon and menu bar both; closing the last window drops the Dock icon (activation policy .accessory)
//           and the menu bar keeps running; opening a window from the gear brings the Dock icon back (.regular).
//
//  Signing in: ASWebAuthenticationSession opens aitutors.me/heddy-chrome/mac-connect with a random `state` and a PKCE
//  challenge (RFC 7636 S256). The site hands a two-minute code back on heddy-mac://connected, and the app swaps
//  code + verifier at POST /api/heddy/mac/token for a 30-day token, kept in the Keychain. The token never sits in a
//  URL. Every call after that is `Authorization: Bearer`. Public repo: client code only.
//

import Cocoa
import Combine
import SwiftUI
import AuthenticationServices
import ServiceManagement
import CryptoKit
import Security
import SafariServices
import WebKit

// MARK: - Settings

enum HeddyMac {
    static let origin = URL(string: "https://aitutors.me")!
    static let callbackScheme = "heddy-mac"
    static let refreshEvery: TimeInterval = 5 * 60
    static let keychainService = "me.aitutors.heddy.safari.mac"
    static let keychainAccount = "mac-token"
    static let welcomeShownKey = "heddyMac.welcomeShown.v1"
    static let lastPanelKey = "heddyMac.lastPanel.v1"
}

// MARK: - The panel feed (GET /api/heddy/mac/panel, lib/heddy-mac/panel-view.ts `MacPanel`, v1)

struct MacPanel: Codable, Equatable {
    struct Week: Codable, Equatable {
        struct Day: Codable, Equatable {
            let day: String
            let isToday: Bool
            let checkedIn: Bool
            let test: Bool
        }
        let no: Int
        let range: String
        let days: [Day]
        /// nil when check-ins could not be read: the ring is then left empty.
        let checkIns: Int?
        let goal: Int
    }
    struct Item: Codable, Equatable, Identifiable {
        let id: String
        let time: String?
        let title: String
        let colour: String?
    }
    struct NextTest: Codable, Equatable {
        let title: String
        let day: String
        let daysAway: Int
    }
    struct Todo: Codable, Equatable, Identifiable {
        let id: String
        let title: String
        let priority: String
        var done: Bool
        /// todo | doing | done: the row's pill (M15). Absent from a feed before M15 (and a saved panel): read from `done`.
        var status: String?
        var state: String { status ?? (done ? "done" : "todo") }
    }
    struct Line: Codable, Equatable {
        /// open | written | unknown
        var state: String
        /// sleepy | wobbly | calm | bright
        var mood: String?
    }

    let v: Int
    let builtAt: String
    let today: String
    let day: String
    let lang: String
    let week: Week
    let items: [Item]
    let nextTest: NextTest?
    /// At most five OPEN to-dos (M15): Doing first, then To do, in the board's order.
    var todos: [Todo]
    var openTodos: Int
    /// To-dos ticked today: the header's "M done". nil from a feed before M15.
    var doneToday: Int?
    /// nil when unread: no badge, never a false 0.
    let cardsDue: Int?
    var line: Line
}

private struct PanelEnvelope: Decodable {
    let type: String
    let panel: MacPanel?
}

struct TypeEnvelope: Decodable {
    let type: String?
    let reason: String?
    let message: String?
    let token: String?
    let expiresAt: String?
}

// MARK: - Days (UK), done the way the site does them

enum UKDay {
    static let zone = TimeZone(identifier: "Europe/London")!
    static var calendar: Calendar {
        var c = Calendar(identifier: .iso8601)
        c.timeZone = zone
        return c
    }
    private static func formatter(_ format: String, _ lang: Lang = .en) -> DateFormatter {
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = zone
        f.locale = Locale(identifier: lang == .zh ? "zh_Hans_CN" : "en_GB")
        f.dateFormat = format
        return f
    }
    static func string(_ date: Date) -> String { formatter("yyyy-MM-dd").string(from: date) }
    static func date(_ day: String) -> Date? {
        guard let d = formatter("yyyy-MM-dd").date(from: day) else { return nil }
        return calendar.date(byAdding: .hour, value: 12, to: d)
    }
    static func add(_ day: String, _ n: Int) -> String {
        guard let d = date(day), let m = calendar.date(byAdding: .day, value: n, to: d) else { return day }
        return string(m)
    }
    static func monday(_ day: String) -> String {
        guard let d = date(day) else { return day }
        let weekday = calendar.component(.weekday, from: d) // 1 = Sunday
        return add(day, -((weekday + 5) % 7))
    }
    static func dayOfMonth(_ day: String) -> String { String(Int(day.suffix(2)) ?? 0) }
    /// "Sat 14" / "周六 14"
    static func short(_ day: String, _ lang: Lang) -> String {
        guard let d = date(day) else { return day }
        return lang == .zh ? formatter("EEE d", .zh).string(from: d) : formatter("EEE d").string(from: d)
    }
    /// "17 Nov" / "11月17日": the date without its weekday.
    static func dayMonth(_ day: String, _ lang: Lang) -> String {
        guard let d = date(day) else { return day }
        return lang == .zh ? formatter("M月d日", .zh).string(from: d) : formatter("d MMM").string(from: d)
    }
    /// The day pill, ‹ [word · rest] ›. The weekday is never said twice:
    ///   today "Today · Sat 14", yesterday "Yesterday · Fri 13", tomorrow "Tomorrow · Sun 15",
    ///   any other day "Tue · 17 Nov".
    static func pill(_ day: String, today: String, _ w: Words) -> (word: String, rest: String) {
        if day == today { return (w.today, short(day, w.lang)) }
        if day == add(today, -1) { return (w.yesterday, short(day, w.lang)) }
        if day == add(today, 1) { return (w.tomorrow, short(day, w.lang)) }
        return (weekdayName(day, w.lang), dayMonth(day, w.lang))
    }
    /// "Mon" / "周一"
    static func weekdayName(_ day: String, _ lang: Lang) -> String {
        guard let d = date(day) else { return "" }
        return formatter("EEE", lang).string(from: d)
    }
    /// The week line when there is no panel yet (signed out): the same numbers the site draws.
    static func localWeek(_ lang: Lang, now: Date = Date()) -> (no: Int, range: String) {
        let today = string(now)
        let mon = monday(today)
        let sun = add(mon, 6)
        let no = date(mon).map { calendar.component(.weekOfYear, from: $0) } ?? 0
        guard let m = date(mon), let s = date(sun) else { return (no, "") }
        let sameMonth = calendar.component(.month, from: m) == calendar.component(.month, from: s)
        if lang == .zh {
            // lib/exams/hall.ts weekRange: "11月9–15日", or "10月27日–11月2日"
            let a = formatter(sameMonth ? "M月d" : "M月d日", .zh).string(from: m)
            let b = formatter(sameMonth ? "d日" : "M月d日", .zh).string(from: s)
            return (no, "\(a)–\(b)")
        }
        let a = formatter(sameMonth ? "d" : "d MMM").string(from: m)
        let b = formatter("d MMM").string(from: s)
        return (no, "\(a)–\(b)")
    }
}

// MARK: - Words (English, and Chinese when the Mac's first language is Chinese)

enum Lang: String { case en, zh }

struct Words {
    let lang: Lang
    var week: (Int, String) -> String {
        lang == .zh ? { "第\($0)周 · \($1)" } : { "WEEK \($0) · \($1.uppercased())" }
    }
    var today: String { lang == .zh ? "今天" : "Today" }
    var yesterday: String { lang == .zh ? "昨天" : "Yesterday" }
    var tomorrow: String { lang == .zh ? "明天" : "Tomorrow" }
    var todayBox: String { lang == .zh ? "今天" : "TODAY" }
    var todoBox: String { lang == .zh ? "待办" : "TO-DO" }
    var checkIns: String { lang == .zh ? "签到" : "check-ins" }
    var ringLabel: (Int?, Int) -> String {
        lang == .zh ? { "本周签到 \($0.map(String.init) ?? "–")/\($1) 天" } : { "\($0.map(String.init) ?? "No") of \($1) check-ins this week" }
    }
    var allDay: String { lang == .zh ? "全天" : "All day" }
    var nothingToday: String { lang == .zh ? "这天没有安排。" : "Nothing on this day." }
    var noTodos: String { lang == .zh ? "没有待办。" : "No to-dos." }
    var checkInToday: String { lang == .zh ? "今天签到" : "Check in today" }
    var checkInPoints: (Int) -> String { lang == .zh ? { "+\($0) 分" } : { "+\($0) pts" } }
    var addTodo: String { lang == .zh ? "+ 添加待办" : "+ Add a to-do" }
    var addTodoPlaceholder: String { lang == .zh ? "新的待办" : "New to-do" }
    var addFailed: String { lang == .zh ? "没有添加成功，再试一次。" : "Couldn't add that. Try again." }
    var added: String { lang == .zh ? "已添加到你的待办。" : "Added to your to-dos." }
    var cancelAdd: String { lang == .zh ? "取消" : "Cancel" }
    /// The board's three statuses, the catalog's own words (aitutors messages/*/myCalendar.json `statuses`).
    func status(_ s: String) -> String {
        switch s {
        case "doing": return lang == .zh ? "进行中" : "Doing"
        case "done": return lang == .zh ? "已完成" : "Done"
        default: return lang == .zh ? "待做" : "To do"
        }
    }
    var todoCounts: (Int, Int) -> String { lang == .zh ? { "\($0) 未完成 · \($1) 已完成" } : { "\($0) open · \($1) done" } }
    var allInCalendar: (Int) -> String { lang == .zh ? { "在我的日历看全部 \($0) 项 ↗" } : { "All \($0) in My calendar ↗" } }
    var pillHelp: String { lang == .zh ? "点一下切换" : "Click to change" }
    var pillLabel: (String, String) -> String { lang == .zh ? { "\($0)：\($1)。点一下切换" } : { "\($0): \($1). Click to change" } }
    var linePlaceholder: String { lang == .zh ? "今晚一句……今天的一件事" : "Tonight's line … one thing from today" }
    var lineKept: String { lang == .zh ? "今晚一句已保存，写新的会替换它" : "Kept tonight. Write again to change it" }
    var lineNotToday: String { lang == .zh ? "今晚一句只写在今天" : "Tonight's line is for today" }
    var lineFailed: String { lang == .zh ? "没有保存成功，再试一次。" : "That didn't save. Try again." }
    var writeFailed: String { lang == .zh ? "没有保存成功，再试一次。" : "That didn't save. Try again." }
    var moodButton: (String) -> String {
        lang == .zh ? { "Heddy 的心情：\($0)（点一下换）" } : { "How Heddy feels: \($0) (tap to change)" }
    }
    func mood(_ m: String) -> String {
        switch m {
        case "sleepy": return lang == .zh ? "累了" : "Tired"
        case "wobbly": return lang == .zh ? "不太稳" : "Wobbly"
        case "bright": return lang == .zh ? "开心" : "Happy"
        default: return lang == .zh ? "平静" : "Calm"
        }
    }
    var previousDay: String { lang == .zh ? "前一天" : "Previous day" }
    var nextDay: String { lang == .zh ? "后一天" : "Next day" }
    var openCalendar: String { lang == .zh ? "打开我的日历" : "Open My calendar" }
    var home: String { lang == .zh ? "主页" : "Home" }
    var jotters: String { lang == .zh ? "批注本" : "Jotters" }
    var cards: String { lang == .zh ? "闪卡" : "Cards" }
    var cardsDue: (Int) -> String { lang == .zh ? { "闪卡，\($0) 张待复习" } : { "Cards, \($0) to review" } }
    var clips: String { lang == .zh ? "短片" : "Clips" }
    var exams: String { lang == .zh ? "考试" : "Exams" }
    var tutors: String { lang == .zh ? "导师" : "Tutors" }
    var settings: String { lang == .zh ? "设置" : "Settings" }
    var heddyMenu: String { lang == .zh ? "Heddy 菜单" : "Heddy menu" }
    var askMentorPlaceholder: String { lang == .zh ? "问 Mentor，或加到日历" : "Ask Mentor, or add to your calendar" }
    var mentor: String { lang == .zh ? "Mentor" : "Mentor" }
    var connectBlurb: String {
        lang == .zh ? "连接 aitutors.me，就能在这里看到你的一周、待办和今晚一句。" : "Connect to aitutors.me to see your week, your to-dos and tonight's line here."
    }
    var connect: String { lang == .zh ? "连接 aitutors.me" : "Connect to aitutors.me" }
    var connecting: String { lang == .zh ? "请在浏览器里完成连接……" : "Finish in your browser…" }
    var connectFailed: String { lang == .zh ? "没有连接成功，再试一次。" : "That didn't connect. Try again." }
    var offline: String { lang == .zh ? "现在连不上 aitutors.me，稍后会再试。" : "Can't reach aitutors.me just now. Heddy will try again." }
    // gear menu
    var turnOnInSafari: String { lang == .zh ? "在 Safari 中打开 Heddy…" : "Turn on Heddy in Safari…" }
    var openAtLogin: String { lang == .zh ? "登录时打开 Heddy" : "Open Heddy when I log in" }
    var disconnect: String { lang == .zh ? "断开 aitutors.me" : "Disconnect from aitutors.me" }
    var quit: String { lang == .zh ? "退出 Heddy" : "Quit Heddy" }
    // welcome sheet
    var welcomeTitle: String { lang == .zh ? "Heddy 现在住在菜单栏里" : "Heddy now lives in your menu bar" }
    var welcomeBody: String {
        lang == .zh ? "点屏幕顶部的猫头鹰，就能看到你的一周、待办和今晚一句。" : "Click the owl at the top of your screen for your week, your to-dos and tonight's line."
    }
    var start: String { lang == .zh ? "开始" : "Start" }
    var dayLetters: [String] { lang == .zh ? ["一", "二", "三", "四", "五", "六", "日"] : ["M", "T", "W", "T", "F", "S", "S"] }
}

extension Lang {
    /// Chinese when the Mac's first preferred language is Chinese; the site's /zh pages follow.
    static var system: Lang { (Locale.preferredLanguages.first ?? "en").hasPrefix("zh") ? .zh : .en }
}

// MARK: - The token, in the Keychain (generic password, this app only)

struct MacToken: Codable, Equatable {
    let token: String
    let expiresAt: Date
    var isLive: Bool { expiresAt > Date() }
}

enum TokenStore {
    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: HeddyMac.keychainService,
         kSecAttrAccount as String: HeddyMac.keychainAccount]
    }
    static func load() -> MacToken? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return try? JSONDecoder().decode(MacToken.self, from: data)
    }
    @discardableResult
    static func save(_ token: MacToken) -> Bool {
        guard let data = try? JSONEncoder().encode(token) else { return false }
        SecItemDelete(query as CFDictionary)
        var q = query
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        return SecItemAdd(q as CFDictionary, nil) == errSecSuccess
    }
    static func clear() { SecItemDelete(query as CFDictionary) }
}

// MARK: - PKCE (RFC 7636, S256), matching lib/heddy-mac/token.ts: VERIFIER 43–128, CHALLENGE 43, state 16–128

enum PKCE {
    static func base64url(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
    static func random(_ bytes: Int) -> String {
        var buf = [UInt8](repeating: 0, count: bytes)
        if SecRandomCopyBytes(kSecRandomDefault, bytes, &buf) != errSecSuccess {
            for i in buf.indices { buf[i] = UInt8.random(in: 0...255) }
        }
        return base64url(Data(buf))
    }
    /// 64 random bytes → 86 characters.
    static func verifier() -> String { random(64) }
    /// 32 random bytes → 43 characters.
    static func state() -> String { random(32) }
    static func challenge(_ verifier: String) -> String { base64url(Data(SHA256.hash(data: Data(verifier.utf8)))) }
}

// MARK: - aitutors.me

enum Fetch<T> {
    case ok(T)
    /// 401: the token is gone or the login was switched off. Back to "Connect".
    case signedOut
    /// Anything else (offline, 404 before the routes ship, 503): keep the last good panel.
    case unavailable
}

enum WriteOutcome {
    /// `itemId`: the board item the write made or changed (the envelope's `item.id`), when it says.
    case ok(points: Int, itemId: String? = nil)
    case safeguarding(String)
    case closed
    case signedOut
    /// Why, for the log (HTTP status, the envelope's type and reason, or the network error). Never shown as is.
    case failed(String)
}

struct HeddyAPI {
    var origin = HeddyMac.origin
    var session: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        c.timeoutIntervalForRequest = 20
        return URLSession(configuration: c)
    }()

    func url(_ path: String, _ query: [URLQueryItem] = []) -> URL {
        var c = URLComponents(url: origin.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { c.queryItems = query }
        return c.url!
    }

    private func request(_ url: URL, method: String = "GET", token: String? = nil, body: [String: Any]? = nil) -> URLRequest {
        var r = URLRequest(url: url)
        r.httpMethod = method
        r.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
            r.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        return r
    }

    func panel(token: String, day: String?, lang: Lang) async -> Fetch<MacPanel> {
        var q = [URLQueryItem(name: "lang", value: lang.rawValue)]
        if let day { q.append(URLQueryItem(name: "day", value: day)) }
        guard let (data, res) = try? await session.data(for: request(url("/api/heddy/mac/panel", q), token: token)),
              let http = res as? HTTPURLResponse else { return .unavailable }
        if http.statusCode == 401 { return .signedOut }
        guard http.statusCode == 200, let env = try? JSONDecoder().decode(PanelEnvelope.self, from: data),
              env.type == "ok", let panel = env.panel else { return .unavailable }
        return .ok(panel)
    }

    /// POST /api/heddy/mac/token: the connect code + this app's verifier → the 30-day token.
    func swap(code: String, verifier: String) async -> MacToken? {
        guard let (data, res) = try? await session.data(for: request(url("/api/heddy/mac/token"), method: "POST", body: ["code": code, "verifier": verifier])),
              (res as? HTTPURLResponse)?.statusCode == 200,
              let env = try? JSONDecoder().decode(TypeEnvelope.self, from: data),
              env.type == "ok", let token = env.token, let exp = env.expiresAt, let expiresAt = Self.parseDate(exp) else { return nil }
        return MacToken(token: token, expiresAt: expiresAt)
    }

    /// A POST the server answers with the board's envelope (lib/calendar/route-kit.ts `envelope`, relayed by
    /// /api/heddy/mac/todo and /line). Any 2xx carrying `type: ok` is a success: 200 today, 201 if it ever changes.
    func write(_ path: String, token: String, body: [String: Any]) async -> WriteOutcome {
        let data: Data, res: URLResponse
        do {
            (data, res) = try await session.data(for: request(url(path), method: "POST", token: token, body: body))
        } catch {
            return .failed("network: \(error.localizedDescription)")
        }
        guard let http = res as? HTTPURLResponse else { return .failed("no HTTP response") }
        if http.statusCode == 401 { return .signedOut }
        let env = try? JSONDecoder().decode(TypeEnvelope.self, from: data)
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        let points = json?["points"] as? Int ?? 0
        let itemId = (json?["item"] as? [String: Any])?["id"] as? String
        let ok2xx = (200..<300).contains(http.statusCode)
        switch env?.type {
        case "ok" where ok2xx: return .ok(points: points, itemId: itemId)
        case "safeguarding" where ok2xx: return .safeguarding(env?.message ?? "If you're struggling, please talk to a parent or call Childline 0800 1111")
        case "window-closed": return .closed
        default: return .failed("HTTP \(http.statusCode) \(env?.type ?? "-") \(env?.reason ?? "")")
        }
    }

    static func parseDate(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }
}

// MARK: - The panel's state

@MainActor
final class PanelStore: ObservableObject {
    @Published private(set) var panel: MacPanel?
    @Published private(set) var token: MacToken?
    @Published private(set) var reachable = true
    @Published private(set) var connecting = false
    @Published var connectError: String?
    @Published var notice: String?
    @Published var mood: String?
    @Published var lineText = ""
    /// Mentor's composer (today, before MentorComposer.lineOpensHour): what she is typing.
    @Published var askText = ""
    @Published var addingTodo = false
    @Published var newTodo = ""
    /// The day ‹ › has moved to; nil = today.
    @Published private(set) var viewDay: String?
    /// "+ Add a to-do": the request in flight, its failure (shown in red under the field), and a short "Added".
    @Published private(set) var addInFlight = false
    @Published var addError: String?
    @Published private(set) var addedNote = false
    /// The popover is on screen: the eyes' loops run only then (battery).
    @Published var panelVisible = false
    /// System Settings › Accessibility › Reduce motion: no loops at all.
    @Published var reduceMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    /// A tap on the eyes: one quick blink from this moment, then the new mood.
    @Published private(set) var blinkAt: Date?
    /// The visible screen's height (the to-do list no longer expands, M15; kept for the popover).
    @Published var screenHeight: CGFloat = NSScreen.main?.visibleFrame.height ?? 800

    private(set) var lang = Lang.system
    var words: Words { Words(lang: lang) }
    var api = HeddyAPI()
    private var refreshing = false

    var connected: Bool { token?.isLive == true }
    var openTodos: Int { connected ? (panel?.openTodos ?? 0) : 0 }

    init(loadSaved: Bool = true) {
        guard loadSaved else { return }
        if let t = TokenStore.load(), t.isLive {
            token = t
            if let data = UserDefaults.standard.data(forKey: HeddyMac.lastPanelKey),
               let saved = try? JSONDecoder().decode(MacPanel.self, from: data) {
                panel = saved
                mood = saved.line.mood
            }
        } else if TokenStore.load() != nil {
            TokenStore.clear()
        }
    }

    /// For previews and the render check: a panel without the network.
    init(fixture: MacPanel, connected: Bool = true) {
        lang = Lang(rawValue: fixture.lang) ?? .system
        panel = fixture
        mood = fixture.line.mood
        if connected { token = MacToken(token: "fixture", expiresAt: Date().addingTimeInterval(86_400)) }
    }

    // MARK: links

    func link(_ path: String) -> URL { api.url((lang == .zh ? "/zh" : "") + path) }

    // MARK: reading

    func refresh() async {
        guard let t = token else { return }
        guard t.isLive else { signOut(); return }
        if refreshing { return }
        refreshing = true
        defer { refreshing = false }
        switch await api.panel(token: t.token, day: viewDay, lang: lang) {
        case .ok(let p):
            reachable = true
            let lineChanged = panel?.line != p.line || panel?.day != p.day
            panel = p
            if lineChanged || mood == nil { mood = p.line.mood }
            if viewDay == nil, let data = try? JSONEncoder().encode(p) {
                UserDefaults.standard.set(data, forKey: HeddyMac.lastPanelKey)
            }
        case .signedOut:
            signOut()
        case .unavailable:
            reachable = false
        }
    }

    // MARK: ‹ › (this week ± 1, the range lib/heddy-mac/panel-view.ts clampDay allows)

    private var dayRange: ClosedRange<String>? {
        guard let today = panel?.today else { return nil }
        let mon = UKDay.monday(today)
        return UKDay.add(mon, -7)...UKDay.add(mon, 13)
    }
    func canMove(_ n: Int) -> Bool {
        guard let p = panel, let range = dayRange else { return false }
        return range.contains(UKDay.add(p.day, n))
    }
    func move(_ n: Int) {
        guard let p = panel, canMove(n) else { return }
        show(UKDay.add(p.day, n))
    }
    func canShow(_ day: String) -> Bool { dayRange?.contains(day) ?? false }
    /// A day stamp clicked: show that day (within the same range ‹ › reaches).
    func show(_ day: String) {
        guard let p = panel, canShow(day), day != p.day else { return }
        viewDay = day == p.today ? nil : day
        notice = nil
        Task { await refresh() }
    }
    func goToday() {
        guard viewDay != nil else { return }
        viewDay = nil
        Task { await refresh() }
    }

    // MARK: writing

    /// The row's box: done, or (a done row) back to To do.
    @discardableResult
    func toggle(_ todo: MacPanel.Todo) -> Task<Void, Never>? { setStatus(todo, todo.state == "done" ? "todo" : "done") }

    /// The row's pill: To do → Doing → Done → To do (M15).
    @discardableResult
    func cycle(_ todo: MacPanel.Todo) -> Task<Void, Never>? { setStatus(todo, TodoList.next(todo.state)) }

    /// Shown at once, sent through /api/heddy/mac/todo, and put back as it was if the server refuses (a 503 for
    /// Doing before the board's 0243 is applied, a network failure): "That didn't save" says so.
    @discardableResult
    func setStatus(_ todo: MacPanel.Todo, _ status: String) -> Task<Void, Never>? {
        guard let t = token, var p = panel, let i = p.todos.firstIndex(where: { $0.id == todo.id }) else { return nil }
        let before = p
        let wasOpen = p.todos[i].state != "done", nowOpen = status != "done"
        p.todos[i].status = status
        p.todos[i].done = !nowOpen
        if wasOpen != nowOpen {
            p.openTodos = max(0, p.openTodos + (nowOpen ? 1 : -1))
            p.doneToday = max(0, (p.doneToday ?? 0) + (nowOpen ? -1 : 1))
        }
        // A done row leaves the list and the next one slides up; a Doing row moves to the top.
        withAnimation(.easeInOut(duration: TodoList.slide)) { panel = p }
        return Task {
            let r = await api.write("/api/heddy/mac/todo", token: t.token, body: ["op": "status", "id": todo.id, "status": status])
            handleWrite(r, revert: before)
            await refresh()
        }
    }

    /// Return in the new to-do box. The text stays until the server has it: a failure keeps it, says so in red
    /// under the box, and logs why. A success closes the box (like the web board) and says "Added".
    @discardableResult
    func addTodo() -> Task<Void, Never>? {
        let title = newTodo.trimmingCharacters(in: .whitespacesAndNewlines)
        if title.isEmpty { cancelAdd(); return nil }
        guard let t = token, !addInFlight else { return nil }
        addInFlight = true
        addError = nil
        return Task {
            let r = await api.write("/api/heddy/mac/todo", token: t.token, body: ["op": "add", "title": title])
            addInFlight = false
            switch r {
            case .ok(_, let itemId):
                newTodo = ""
                addingTodo = false
                if let itemId { showAdded(id: itemId, title: title) }
                flashAdded()
                await refresh()
            case .safeguarding(let message):
                newTodo = ""
                addingTodo = false
                notice = message
                await refresh()
            case .signedOut:
                signOut()
            case .closed:
                addError = words.addFailed
                NSLog("Heddy: add to-do refused: window-closed")
            case .failed(let why):
                addError = words.addFailed
                NSLog("Heddy: add to-do failed: %@", why)
            }
        }
    }

    /// Owner M15 ruling: a to-do added today heads the To do rows (after Doing and the check-in), at once, before the
    /// refresh brings the server's own order (lib/heddy-mac/panel-view.ts, the same rule). The box still shows five.
    func showAdded(id: String, title: String) {
        guard var p = panel, !p.todos.contains(where: { $0.id == id }) else { return }
        let at = p.todos.firstIndex(where: { $0.state != "doing" }) ?? p.todos.count
        p.todos.insert(MacPanel.Todo(id: id, title: title, priority: "none", done: false, status: "todo"), at: at)
        p.openTodos += 1
        withAnimation(.easeInOut(duration: TodoList.slide)) { panel = p }
    }

    /// Esc, or the ✕: close the box and drop what was typed.
    func cancelAdd() {
        addingTodo = false
        newTodo = ""
        addError = nil
    }

    /// Focus left the box: an empty box closes; typed text is kept until Esc or ✕ (never lost by a stray click).
    func blurAdd() {
        if newTodo.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !addInFlight { cancelAdd() }
    }

    private func flashAdded() {
        addedNote = true
        Task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            addedNote = false
        }
    }

    // MARK: the to-do box: five rows, a status pill on each (owner M15, 2026-11-17)

    var todoRows: [TodoRow] { TodoList.rows(checkIn: checkInRow, todos: panel?.todos ?? []) }

    // MARK: Heddy's eyes

    /// The loops run only while the panel is on screen and Reduce Motion is off.
    var eyesAnimating: Bool { panelVisible && !reduceMotion }

    func cycleMood() {
        let order = ["calm", "bright", "sleepy", "wobbly"]
        let i = order.firstIndex(of: mood ?? "calm") ?? 0
        let next = mood == nil ? "bright" : order[(i + 1) % order.count]
        guard eyesAnimating else { mood = next; return }
        // A quick blink, and the new mood arrives with the eyes shut.
        blinkAt = Date()
        Task {
            try? await Task.sleep(nanoseconds: UInt64(HeddyMotion.tapBlink / 2 * 1_000_000_000))
            mood = next
        }
    }

    var lineIsForToday: Bool { panel.map { $0.day == $0.today } ?? false }

    /// The artboard's "Check in today · +5 pts" row. Not a board item (S1 sends no such to-do): derived from the
    /// week's own stamps, shown only on today and only when check-ins were read. Writing Tonight's line is how the
    /// Mac checks a day in (lib/calendar/reflection-write.ts lights a quiet day and pays the check-in), so the row
    /// leads to the line. nil = no row; true = done today (struck through, no points).
    var checkInRow: Bool? {
        guard let p = panel, p.day == p.today, p.week.checkIns != nil,
              let today = p.week.days.first(where: { $0.isToday }) else { return nil }
        return today.checkedIn
    }
    /// lib/calendar/points.ts DAILY_CHECK_IN_POINTS.
    static let checkInPoints = 5

    func sendLine() {
        let line = lineText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let t = token, !line.isEmpty, lineIsForToday else { return }
        var body: [String: Any] = ["line": line]
        if let mood { body["mood"] = mood }
        Task {
            let r = await api.write("/api/heddy/mac/line", token: t.token, body: body)
            switch r {
            case .ok:
                lineText = ""
                notice = nil
                if var p = panel { p.line = .init(state: "written", mood: mood); panel = p }
            case .safeguarding(let message):
                lineText = ""
                notice = message
            case .closed:
                notice = words.lineNotToday
            case .signedOut:
                signOut()
            case .failed:
                notice = words.lineFailed
            }
            await refresh()
        }
    }

    private func handleWrite(_ r: WriteOutcome, revert: MacPanel?) {
        switch r {
        case .ok: notice = nil
        case .safeguarding(let message): notice = message
        case .signedOut: signOut()
        case .closed, .failed:
            if case .failed(let why) = r { NSLog("Heddy: write failed: %@", why) }
            if let revert { panel = revert }
            notice = words.writeFailed
        }
    }

    // MARK: connect / disconnect

    func connected(_ t: MacToken) {
        TokenStore.save(t)
        token = t
        connecting = false
        connectError = nil
        Task { await refresh() }
    }
    func setConnecting(_ on: Bool) { connecting = on; if on { connectError = nil } }
    func connectFailed() { connecting = false; connectError = words.connectFailed }

    func signOut() {
        TokenStore.clear()
        UserDefaults.standard.removeObject(forKey: HeddyMac.lastPanelKey)
        token = nil
        panel = nil
        viewDay = nil
        mood = nil
        notice = nil
        lineText = ""
    }
}

// MARK: - Colours (T1 "Night sky", literally)

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: opacity)
    }
    /// "#RRGGBB" from the feed (label colours), or nil.
    init?(css: String?) {
        guard let css, css.hasPrefix("#"), css.count == 7, let v = UInt32(css.dropFirst(), radix: 16) else { return nil }
        self.init(hex: v)
    }
}

enum Night {
    static let panel = Color(hex: 0x0F1F45)
    static let line = Color(hex: 0x2A3B6B)
    static let control = Color(hex: 0x4A5B8C)
    static let pill = Color(hex: 0x1A2C5A)
    static let soft = Color(hex: 0xC7CEE6)
    static let gold = Color(hex: 0xE8B85A)
    static let green = Color(hex: 0x3E8A4E)
    static let stamp = Color(hex: 0x34467A)
    static let test = Color(hex: 0xF08A7E)
    static let dot = Color(hex: 0x6EA8E8)
    static let mint = Color(hex: 0x8FD39E)
    static let faint = Color(hex: 0x8F98B8)
    static let field = Color(hex: 0x1A2440)
    static let bar = Color(hex: 0x0B1836)
    static let amber = Color(hex: 0xE8A23A)
    static let pupil = Color(hex: 0x0B1B3A)
    /// The to-do pill and box in Doing (the spec's --doing).
    static let doing = Color(hex: 0x7AA7FF)
}

// MARK: - Icons, drawn from the artifact's own 24-unit SVG paths

struct Icon24: Shape {
    let draw: @Sendable (inout Path) -> Void
    func path(in rect: CGRect) -> Path {
        var p = Path()
        draw(&p)
        let s = min(rect.width, rect.height) / 24
        return p.applying(CGAffineTransform(translationX: rect.minX, y: rect.minY).scaledBy(x: s, y: s))
    }
}

enum Icons {
    nonisolated static func poly(_ p: inout Path, _ pts: [(CGFloat, CGFloat)], close: Bool = false) {
        guard let f = pts.first else { return }
        p.move(to: CGPoint(x: f.0, y: f.1))
        for q in pts.dropFirst() { p.addLine(to: CGPoint(x: q.0, y: q.1)) }
        if close { p.closeSubpath() }
    }
    static let back = Icon24 { poly(&$0, [(15, 5), (8, 12), (15, 19)]) }
    static let forward = Icon24 { poly(&$0, [(9, 5), (16, 12), (9, 19)]) }
    static let expand = Icon24 { p in
        poly(&p, [(4, 9), (4, 4), (9, 4)]); poly(&p, [(15, 4), (20, 4), (20, 9)])
        poly(&p, [(20, 15), (20, 20), (15, 20)]); poly(&p, [(9, 20), (4, 20), (4, 15)])
    }
    static let home = Icon24 { p in
        poly(&p, [(4, 11), (12, 4), (20, 11)]); poly(&p, [(6, 10), (6, 20), (18, 20), (18, 10)])
    }
    static let jotters = Icon24 { p in
        p.move(to: CGPoint(x: 6, y: 3)); p.addLine(to: CGPoint(x: 17, y: 3))
        p.addQuadCurve(to: CGPoint(x: 18, y: 4), control: CGPoint(x: 18, y: 3))
        p.addLine(to: CGPoint(x: 18, y: 20))
        p.addQuadCurve(to: CGPoint(x: 17, y: 21), control: CGPoint(x: 18, y: 21))
        p.addLine(to: CGPoint(x: 6, y: 21)); p.closeSubpath()
        poly(&p, [(6, 3), (6, 21)])
        for y in [7.0, 12.0, 17.0] { poly(&p, [(4, y), (7, y)]) }
        poly(&p, [(10, 8), (15, 8)]); poly(&p, [(10, 12), (15, 12)])
    }
    static let cards = Icon24 { p in
        p.addRoundedRect(in: CGRect(x: 7, y: 5, width: 13, height: 15), cornerSize: CGSize(width: 2, height: 2))
        p.move(to: CGPoint(x: 4, y: 16)); p.addLine(to: CGPoint(x: 4, y: 6))
        p.addQuadCurve(to: CGPoint(x: 6, y: 4), control: CGPoint(x: 4, y: 4))
        p.addLine(to: CGPoint(x: 15, y: 4))
    }
    static let clips = Icon24 { p in
        p.addRoundedRect(in: CGRect(x: 3, y: 5, width: 18, height: 14), cornerSize: CGSize(width: 2, height: 2))
        poly(&p, [(10, 9.5), (10, 14.5), (14.5, 12)], close: true)
    }
    static let exams = Icon24 { p in
        poly(&p, [(12, 3), (20, 12), (12, 21), (4, 12)], close: true)
        poly(&p, [(9, 12), (11, 14), (15, 10)])
    }
    static let tutors = Icon24 { p in
        poly(&p, [(2, 9), (12, 4), (22, 9), (12, 14)], close: true)
        p.move(to: CGPoint(x: 6, y: 11)); p.addLine(to: CGPoint(x: 6, y: 16))
        p.addCurve(to: CGPoint(x: 12, y: 19), control1: CGPoint(x: 6, y: 17.5), control2: CGPoint(x: 9, y: 19))
        p.addCurve(to: CGPoint(x: 18, y: 16), control1: CGPoint(x: 15, y: 19), control2: CGPoint(x: 18, y: 17.5))
        p.addLine(to: CGPoint(x: 18, y: 11))
    }
    static let close = Icon24 { p in
        poly(&p, [(6, 6), (18, 18)]); poly(&p, [(18, 6), (6, 18)])
    }
    static let gear = Icon24 { p in
        p.addEllipse(in: CGRect(x: 9, y: 9, width: 6, height: 6))
        for seg in [[(12.0, 2.0), (12.0, 5.0)], [(12, 19), (12, 22)], [(2, 12), (5, 12)], [(19, 12), (22, 12)],
                    [(4.9, 4.9), (7, 7)], [(17, 17), (19.1, 19.1)], [(4.9, 19.1), (7, 17)], [(17, 7), (19.1, 4.9)]] {
            poly(&p, seg.map { (CGFloat($0.0), CGFloat($0.1)) })
        }
    }
}

extension Shape {
    func line(_ width: CGFloat, size: CGFloat) -> some View {
        stroke(style: StrokeStyle(lineWidth: width * size / 24, lineCap: .round, lineJoin: .round))
    }
}

/// The owl for the menu bar (the artifact's 36×32 mark), as a template image so macOS tints it.
enum Owl {
    static func image(height: CGFloat = 16) -> NSImage {
        let w = height * 36 / 32
        let img = NSImage(size: NSSize(width: w, height: height), flipped: true) { rect in
            let s = rect.height / 32
            let t = NSAffineTransform()
            t.scale(by: s)
            NSColor.black.set()
            let ears = NSBezierPath()
            ears.move(to: NSPoint(x: 5, y: 6)); ears.line(to: NSPoint(x: 10, y: 2)); ears.line(to: NSPoint(x: 13, y: 7))
            ears.move(to: NSPoint(x: 31, y: 6)); ears.line(to: NSPoint(x: 26, y: 2)); ears.line(to: NSPoint(x: 23, y: 7))
            ears.lineWidth = 2.4; ears.lineCapStyle = .round; ears.lineJoinStyle = .round
            ears.transform(using: t as AffineTransform); ears.lineWidth = 2.4 * s; ears.stroke()
            for cx in [11.0, 25.0] {
                let eye = NSBezierPath(ovalIn: NSRect(x: cx - 6, y: 10, width: 12, height: 12))
                eye.transform(using: t as AffineTransform); eye.lineWidth = 2.6 * s; eye.stroke()
            }
            let beak = NSBezierPath()
            beak.move(to: NSPoint(x: 15, y: 25)); beak.line(to: NSPoint(x: 18, y: 29)); beak.line(to: NSPoint(x: 21, y: 25)); beak.close()
            beak.transform(using: t as AffineTransform); beak.fill()
            return true
        }
        img.isTemplate = true
        img.accessibilityDescription = "Heddy"
        return img
    }
}

// MARK: - Heddy's eyes (character DNA: amber irises, the LEFT larger, lids tell the mood; night colours)

struct HeddyEyes: View {
    let mood: String?
    var lidColour = Night.field
    /// Run blink + gaze (only while the popover shows and Reduce Motion is off: PanelStore.eyesAnimating).
    var animating = false
    /// The pointer is on the eyes button.
    var lookUp = false
    /// A tap's quick blink starts here.
    var blinkAt: Date? = nil

    private struct Eye { let cx, cy, r, pr, hx, hy, hr: CGFloat }
    private static let left = Eye(cx: 46, cy: 57, r: 13.5, pr: 6.7, hx: 49.5, hy: 53.2, hr: 2.4)
    private static let right = Eye(cx: 74, cy: 57, r: 11, pr: 5.6, hx: 76.8, hy: 53.8, hr: 2)
    /// Both irises (x 32.5–85, y 43.5–70.5) with room all round, the sleepy "z" included: nothing is clipped.
    static let box = CGRect(x: 29, y: 38, width: 60, height: 36)

    /// A lid's lower edge, as shares of the iris's height from its top: at the inner corner, at the outer corner,
    /// and the curve's control point. Calm is the artifact's soft arch (a sliver, the eye shows whole); sleepy is
    /// heavy; wobbly slopes down at the outer corners (character DNA option C, "lids tell it").
    static func lid(_ mood: String) -> (inner: CGFloat, outer: CGFloat, control: CGFloat) {
        switch mood {
        case "sleepy": return (0.5, 0.5, 0.4)
        case "wobbly": return (0.2, 0.46, 0.22)
        default: return (0.16, 0.16, -0.06)
        }
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !animating)) { timeline in
            let pose = HeddyMotion.pose(at: timeline.date, animating: animating, lookUp: lookUp, blinkAt: blinkAt)
            Canvas { ctx, size in
                let s = size.width / Self.box.width
                ctx.scaleBy(x: s, y: s)
                ctx.translateBy(x: -Self.box.minX, y: -Self.box.minY)
                draw(&ctx, mood: mood ?? "calm", blink: pose.blink, gaze: pose.gaze)
            }
        }
        .aspectRatio(Self.box.width / Self.box.height, contentMode: .fit)
        .accessibilityHidden(true)
    }

    private func draw(_ ctx: inout GraphicsContext, mood m: String, blink: CGFloat, gaze: CGPoint) {
        for e in [Self.left, Self.right] {
            // heddy-blink: scaleY about the eye's own middle
            var c = ctx
            c.translateBy(x: 0, y: e.cy)
            c.scaleBy(x: 1, y: max(0.05, blink))
            c.translateBy(x: 0, y: -e.cy)
            if m == "bright" {
                var p = Path()
                p.move(to: CGPoint(x: e.cx - e.r * 0.8, y: e.cy + 1)); p.addQuadCurve(to: CGPoint(x: e.cx + e.r * 0.8, y: e.cy + 1), control: CGPoint(x: e.cx, y: e.cy - e.r * 0.8))
                c.stroke(p, with: .color(Night.amber), style: StrokeStyle(lineWidth: 3.6, lineCap: .round))
                continue
            }
            let iris = CGRect(x: e.cx - e.r, y: e.cy - e.r, width: 2 * e.r, height: 2 * e.r)
            c.fill(Path(ellipseIn: iris), with: .color(Night.amber))
            // heddy-gaze: pupil and highlight move together, scaled so the largest step stays inside the iris
            let k = HeddyMotion.gazeReach * e.r / HeddyMotion.gazeMax
            let rest: CGPoint = m == "sleepy" ? CGPoint(x: 0, y: 2.5) : m == "wobbly" ? CGPoint(x: -1.4, y: 1.8) : .zero
            let dx = rest.x + gaze.x * k, dy = rest.y + gaze.y * k
            c.fill(Path(ellipseIn: CGRect(x: e.cx + dx - e.pr, y: e.cy + dy - e.pr, width: 2 * e.pr, height: 2 * e.pr)), with: .color(Night.pupil))
            c.fill(Path(ellipseIn: CGRect(x: e.hx + dx - e.hr, y: e.hy + dy - e.hr, width: 2 * e.hr, height: 2 * e.hr)), with: .color(.white))
            // the lid, clipped to the iris
            let l = Self.lid(m)
            let outerIsLeft = e.cx < 60
            let top = e.cy - e.r, h = 2 * e.r
            let yLeft = top + h * (outerIsLeft ? l.outer : l.inner)
            let yRight = top + h * (outerIsLeft ? l.inner : l.outer)
            let x0 = e.cx - e.r - 1, x1 = e.cx + e.r + 1
            var lid = Path()
            lid.move(to: CGPoint(x: x0, y: top - 1)); lid.addLine(to: CGPoint(x: x1, y: top - 1))
            lid.addLine(to: CGPoint(x: x1, y: yRight))
            lid.addQuadCurve(to: CGPoint(x: x0, y: yLeft), control: CGPoint(x: e.cx, y: top + h * l.control))
            lid.closeSubpath()
            var clip = c
            clip.clip(to: Path(ellipseIn: iris.insetBy(dx: -0.2, dy: -0.2)))
            clip.fill(lid, with: .color(lidColour))
        }
        if m == "sleepy" {
            ctx.draw(Text("z").font(.system(size: 9, design: .serif).italic()).foregroundColor(Night.soft.opacity(0.8)), at: CGPoint(x: 86, y: 43))
        }
    }
}

// MARK: - Mentor's composer (owner 2026-11-16): today before 21:00, in place of Tonight's line
//
// Tonight's line belongs to the evening. Until 21:00 (lineOpensHour, the Mac's local time) on today, the row is
// Mentor's composer (owner 2026-11-16; change the hour in lineOpensHour and nowhere else):
// his crest and one box. Enter opens My calendar on aitutors.me with the Ask Mentor room ALREADY OPEN and her words
// ALREADY SENT (`/study/calendar?day=<today>&ask=<text>`, aitutors lib/calendar/ask-link.ts). Mentor decides there,
// with the calendar's own judgement: he drafts an event card (Add / Undo) or he answers. No AI runs in this app.

enum MentorComposer {
    /// The hour Tonight's line takes the row back, local time. The ONE place this hour is written.
    static let lineOpensHour = 21
    /// The most a link carries (aitutors ASK_MAX): the server cuts there too.
    static let askMax = 500

    /// Tonight's line shows on any day but today, and on today from lineOpensHour.
    static func showsLine(isToday: Bool, now: Date, calendar: Calendar = .current) -> Bool {
        !isToday || calendar.component(.hour, from: now) >= lineOpensHour
    }

    /// When the row next changes on its own: today at lineOpensHour, or after it the coming midnight (a new today).
    static func nextFlip(after now: Date, calendar: Calendar = .current) -> Date {
        let start = calendar.startOfDay(for: now)
        let opens = calendar.date(byAdding: .hour, value: lineOpensHour, to: start)!
        return now < opens ? opens : calendar.date(byAdding: .day, value: 1, to: start)!
    }

    /// The panel's wake-ups: the next flip and the one after it (21:00, then midnight; or midnight, then 21:00), so a
    /// panel left open across both still turns over without being redrawn by anything else.
    static func flips(after now: Date, calendar: Calendar = .current) -> [Date] {
        let first = nextFlip(after: now, calendar: calendar)
        return [first, nextFlip(after: first, calendar: calendar)]
    }

    /// The link that opens the room with her words sent; nil when there are no words. `+` is percent-encoded:
    /// URLSearchParams on the page would read a bare `+` as a space.
    static func askURL(_ text: String, day: String, base: URL) -> URL? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        var c = URLComponents(url: base, resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "day", value: day), URLQueryItem(name: "ask", value: String(t.prefix(askMax)))]
        c.percentEncodedQuery = c.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        return c.url
    }
}

/// Mentor's crest, as the calendar draws it (aitutors components/calendar/OwnItems.tsx MentorMark, viewBox 100):
/// a paper disc ringed in green, three ink dots fading left to right.
struct MentorCrest: View {
    static let paper = Color(hex: 0xFDFCF8)
    static let ring = Color(hex: 0x2F8A53)
    static let ink = Color(hex: 0x14253F)
    var body: some View {
        Canvas { ctx, size in
            let s = size.width / 100
            ctx.scaleBy(x: s, y: s)
            let disc = Path(ellipseIn: CGRect(x: 4, y: 4, width: 92, height: 92))
            ctx.fill(disc, with: .color(Self.paper))
            ctx.stroke(disc, with: .color(Self.ring), lineWidth: 3)
            for (x, o) in [(33.0, 1.0), (50, 0.5), (67, 0.25)] {
                ctx.fill(Path(ellipseIn: CGRect(x: x - 5, y: 47, width: 10, height: 10)), with: .color(Self.ink.opacity(o)))
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }
}

// MARK: - The to-do box's rows: five, a status pill on each (owner M15, 2026-11-17, design B)

enum TodoRow: Identifiable, Equatable {
    /// The "Check in today · +5 pts" row (derived, see PanelStore.checkInRow).
    case checkIn(done: Bool)
    case todo(MacPanel.Todo)
    var id: String {
        switch self {
        case .checkIn: return "checkin"
        case .todo(let t): return t.id
        }
    }
}

enum TodoList {
    /// The box never lists more than this; "All N in My calendar ↗" opens the rest on the web.
    static let rows = 5
    /// A row leaving (done) or moving up (Doing) slides.
    static let slide: Double = 0.15

    /// The pill's cycle: To do → Doing → Done → To do.
    static func next(_ s: String) -> String {
        switch s {
        case "todo": return "doing"
        case "doing": return "done"
        default: return "todo"
        }
    }

    /// Doing first, then To do (the unticked check-in leads it, as the artboard's first To do), each in S1's order.
    /// Done rows leave the list; the header keeps their count. Never more than five.
    static func rows(checkIn: Bool?, todos: [MacPanel.Todo]) -> [TodoRow] {
        let open = todos.filter { $0.state != "done" }
        let doing = open.filter { $0.state == "doing" }.map(TodoRow.todo)
        let todo = open.filter { $0.state != "doing" }.map(TodoRow.todo)
        return Array((doing + (checkIn == false ? [.checkIn(done: false)] : []) + todo).prefix(rows))
    }
}

// MARK: - Heddy's eyes in motion (the product's own keyframes: aitutors app/styles/heddy-motion.css = study.css)

enum HeddyMotion {
    /// `heddy-blink` on the eyes (scaleY) and `heddy-gaze` on the pupils, with the site's loop lengths.
    static let blinkPeriod: TimeInterval = 6.5
    static let gazePeriod: TimeInterval = 11
    static let blinkKeys: [(Double, CGFloat)] = [
        (0, 1), (0.30, 1), (0.34, 0.1), (0.38, 1), (0.72, 1), (0.78, 0.74), (0.84, 0.74), (0.90, 1), (1, 1),
    ]
    static let gazeKeys: [(Double, CGPoint)] = [
        (0, .zero), (0.16, .zero), (0.22, CGPoint(x: 3.2, y: -1)), (0.30, CGPoint(x: 3.2, y: -1)),
        (0.36, CGPoint(x: 0, y: -0.5)), (0.46, CGPoint(x: 0, y: -0.5)), (0.52, CGPoint(x: -3, y: 1.4)),
        (0.60, CGPoint(x: -3, y: 1.4)), (0.66, CGPoint(x: 0.6, y: -2)), (0.74, CGPoint(x: 0.6, y: -2)),
        (0.80, .zero), (1, .zero),
    ]
    /// The gaze's largest step (3.2) moves a pupil this share of its iris's radius: it never leaves the iris.
    static let gazeReach: CGFloat = 0.4
    static let gazeMax: CGFloat = 3.2
    /// Pointer on the button: she looks up at it.
    static let lookUp = CGPoint(x: 0, y: -2.4)
    /// A tap: shut and open in this long; the new mood lands half way.
    static let tapBlink: TimeInterval = 0.24

    /// CSS's default `ease` between keyframes, near enough: smoothstep.
    private static func ease(_ t: Double) -> Double { t * t * (3 - 2 * t) }
    private static func segment<T>(_ keys: [(Double, T)], _ phase: Double) -> (T, T, Double) {
        for i in 1..<keys.count where phase <= keys[i].0 {
            let (a, b) = (keys[i - 1], keys[i])
            let t = b.0 > a.0 ? (phase - a.0) / (b.0 - a.0) : 1
            return (a.1, b.1, ease(min(1, max(0, t))))
        }
        return (keys[keys.count - 1].1, keys[keys.count - 1].1, 1)
    }
    static func blink(phase: Double) -> CGFloat {
        let (a, b, t) = segment(blinkKeys, phase)
        return a + (b - a) * CGFloat(t)
    }
    static func gaze(phase: Double) -> CGPoint {
        let (a, b, t) = segment(gazeKeys, phase)
        return CGPoint(x: a.x + (b.x - a.x) * CGFloat(t), y: a.y + (b.y - a.y) * CGFloat(t))
    }
    /// The eyes' pose at `date`. Not animating: open, looking ahead (or up at the pointer), no blinks.
    static func pose(at date: Date, animating: Bool, lookUp: Bool, blinkAt: Date?) -> (blink: CGFloat, gaze: CGPoint) {
        guard animating else { return (1, lookUp ? Self.lookUp : .zero) }
        let t = date.timeIntervalSinceReferenceDate
        var blink = Self.blink(phase: t.truncatingRemainder(dividingBy: blinkPeriod) / blinkPeriod)
        let gaze = lookUp ? Self.lookUp : Self.gaze(phase: t.truncatingRemainder(dividingBy: gazePeriod) / gazePeriod)
        if let b = blinkAt {
            let since = date.timeIntervalSince(b)
            if since >= 0 && since < tapBlink { blink = min(blink, 1 - 0.9 * CGFloat(sin(Double.pi * since / tapBlink))) }
        }
        return (blink, gaze)
    }
}

// MARK: - Hover and press (owner 2026-11-15: "when the pointer hovers on it, please give reactions")
//
// One look for every control in the panel, in the artifact's own tokens: a white lift on hover, a darker press,
// a gold edge on the bordered controls, 120 ms ease; the pointing hand over anything clickable and the I-beam over
// a text box. A disabled control does not react at all. Keyboard focus rings are left to the system.

enum Lift {
    static let hover = 0.09
    static let row = 0.06
    static let press = 0.14
    static let edge = 0.6
    static let ease = Animation.easeOut(duration: 0.12)
}

private struct NightHoverKey: EnvironmentKey { static let defaultValue = false }
private struct NightPreviewHoverKey: EnvironmentKey { static let defaultValue: String? = nil }
private struct PanelPreviewNowKey: EnvironmentKey { static let defaultValue: Date? = nil }
extension EnvironmentValues {
    /// True inside a hovered control, so its parts can react too (a to-do's tick box).
    var nightHover: Bool {
        get { self[NightHoverKey.self] }
        set { self[NightHoverKey.self] = newValue }
    }
    /// For a rendered preview only: the clock the 21:00 switch reads (nil in the app: the real time).
    var panelPreviewNow: Date? {
        get { self[PanelPreviewNowKey.self] }
        set { self[PanelPreviewNowKey.self] = newValue }
    }
    /// For a rendered preview only: the control whose hoverID matches draws as hovered.
    var nightPreviewHover: String? {
        get { self[NightPreviewHoverKey.self] }
        set { self[NightPreviewHoverKey.self] = newValue }
    }
}

/// Pushes `cursor` while the pointer is inside and `active`; always pops what it pushed.
struct HoverCursor: ViewModifier {
    let cursor: NSCursor
    let active: Bool
    @State private var pushed = false
    func body(content: Content) -> some View {
        content
            .onHover { inside in
                if inside && active && !pushed {
                    cursor.push()
                    pushed = true
                } else if (!inside || !active) && pushed {
                    NSCursor.pop()
                    pushed = false
                }
            }
            .onChange(of: active) { _, now in
                if !now && pushed { NSCursor.pop(); pushed = false }
            }
            .onDisappear {
                if pushed { NSCursor.pop(); pushed = false }
            }
    }
}

extension View {
    func hoverCursor(_ cursor: NSCursor, when active: Bool = true) -> some View {
        modifier(HoverCursor(cursor: cursor, active: active))
    }
}

/// Every button in the panel. `shape` is what lifts; `edge` (gold) brightens the border of bordered controls.
struct NightButton<S: InsettableShape>: ButtonStyle {
    let shape: S
    var edge: Color? = nil
    var amount: Double = Lift.hover
    var hoverID: String? = nil
    func makeBody(configuration: Configuration) -> some View {
        NightButtonBody(label: configuration.label, pressed: configuration.isPressed, shape: shape, edge: edge, amount: amount, hoverID: hoverID)
    }
}

private struct NightButtonBody<S: InsettableShape>: View {
    let label: ButtonStyleConfiguration.Label
    let pressed: Bool
    let shape: S
    let edge: Color?
    let amount: Double
    let hoverID: String?
    @Environment(\.isEnabled) private var enabled
    @Environment(\.nightPreviewHover) private var preview
    @State private var hovering = false
    private var lit: Bool { enabled && (hovering || (hoverID != nil && preview == hoverID)) }
    var body: some View {
        label
            .environment(\.nightHover, lit)
            .overlay(shape.fill(Color.white.opacity(lit && !pressed ? amount : 0)).allowsHitTesting(false))
            .overlay(shape.fill(Color.black.opacity(enabled && pressed ? Lift.press : 0)).allowsHitTesting(false))
            .overlay {
                if let edge { shape.strokeBorder(edge.opacity(lit ? Lift.edge : 0), lineWidth: 1).allowsHitTesting(false) }
            }
            .animation(Lift.ease, value: lit)
            .animation(Lift.ease, value: pressed)
            .onHover { hovering = $0 }
            .hoverCursor(.pointingHand, when: enabled)
    }
}

/// A text box: gold edge on hover, stronger while typing in it, the I-beam; nothing when disabled.
struct FieldHover: ViewModifier {
    let enabled: Bool
    var focused = false
    var hoverID: String? = nil
    @Environment(\.nightPreviewHover) private var preview
    @State private var hovering = false
    private var lit: Bool { enabled && (hovering || (hoverID != nil && preview == hoverID)) }
    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(Night.gold.opacity(enabled && focused ? 0.9 : lit ? Lift.edge : 0), lineWidth: 1)
                    .allowsHitTesting(false)
            )
            .animation(Lift.ease, value: lit)
            .animation(Lift.ease, value: focused)
            .onHover { hovering = $0 }
            .hoverCursor(.iBeam, when: enabled)
    }
}

// MARK: - heddy.app's mascot (owner 2026-11-15: the bottom-right button wears it)
//
// aitutors public/heddyapp/landing/heddy-focus.svg (the snowy owl, viewBox 120×120), drawn path for path, static
// (its CSS animation classes are dropped), on heddy.app's header tile (app/heddyapp/_landing/SiteChrome.tsx): 34 px,
// radius 10, radial-gradient(120% 110% at 26% 14%, #1c3763 0%, #0b1120 78%), a 6 px #DC9400 dot with a glow at
// 4 px / 4 px, the owl 31 px at left 2 / bottom −2, clipped by the tile. `size` scales the whole tile.

struct HeddyMascot: View {
    var size: CGFloat = 34
    static let ink = Color(hex: 0x00173B)
    static let amber = Color(hex: 0xDC9400)
    static let wing = Color(hex: 0xECEBE5)
    static let star = Color(hex: 0x238744)

    var body: some View {
        let k = size / 34
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 10 * k)
                .fill(EllipticalGradient(stops: [.init(color: Color(hex: 0x1C3763), location: 0), .init(color: Color(hex: 0x0B1120), location: 0.78)],
                                         center: UnitPoint(x: 0.26, y: 0.14), startRadiusFraction: 0, endRadiusFraction: 1.15))
            Canvas { ctx, sz in
                let s = sz.width / 120
                ctx.scaleBy(x: s, y: s)
                Self.draw(&ctx)
            }
            .frame(width: 31 * k, height: 31 * k)
            .offset(x: 2 * k, y: (34 - 31 + 2) * k)
            Circle().fill(Self.amber)
                .frame(width: 6 * k, height: 6 * k)
                .shadow(color: Self.amber.opacity(0.45), radius: 3 * k)
                .offset(x: (34 - 4 - 6) * k, y: 4 * k)
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 10 * k))
        .shadow(color: Self.ink.opacity(0.45), radius: 3 * k, y: 2 * k)
        .accessibilityHidden(true)
    }

    private static func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x, y: y) }

    static func draw(_ ctx: inout GraphicsContext) {
        var wl = Path()
        wl.move(to: pt(33, 54)); wl.addCurve(to: pt(33, 99), control1: pt(21, 64), control2: pt(21, 88))
        wl.addCurve(to: pt(42, 60), control1: pt(42, 90), control2: pt(42, 70)); wl.closeSubpath()
        var wr = Path()
        wr.move(to: pt(87, 54)); wr.addCurve(to: pt(87, 99), control1: pt(99, 64), control2: pt(99, 88))
        wr.addCurve(to: pt(78, 60), control1: pt(78, 90), control2: pt(78, 70)); wr.closeSubpath()
        ctx.fill(wl, with: .color(wing)); ctx.fill(wr, with: .color(wing))
        ctx.fill(Path(ellipseIn: CGRect(x: 43.5, y: 102, width: 13, height: 8)), with: .color(amber))
        ctx.fill(Path(ellipseIn: CGRect(x: 63.5, y: 102, width: 13, height: 8)), with: .color(amber))
        var body = Path()
        body.move(to: pt(60, 18)); body.addCurve(to: pt(96, 62), control1: pt(82, 18), control2: pt(96, 36))
        body.addCurve(to: pt(60, 107), control1: pt(96, 90), control2: pt(80, 107))
        body.addCurve(to: pt(24, 62), control1: pt(40, 107), control2: pt(24, 90))
        body.addCurve(to: pt(60, 18), control1: pt(24, 36), control2: pt(38, 18)); body.closeSubpath()
        ctx.fill(body, with: .color(.white)); ctx.stroke(body, with: .color(ink.opacity(0.10)), lineWidth: 2)
        var tuft = Path()
        tuft.move(to: pt(55.5, 18)); tuft.addQuadCurve(to: pt(64.5, 18), control: pt(60, 8.5))
        ctx.fill(tuft, with: .color(.white)); ctx.stroke(tuft, with: .color(ink.opacity(0.10)), lineWidth: 2)
        var face = Path()
        face.move(to: pt(60, 38)); face.addQuadCurve(to: pt(37, 62), control: pt(39, 41))
        face.addQuadCurve(to: pt(60, 82), control: pt(39, 79)); face.addQuadCurve(to: pt(83, 62), control: pt(81, 79))
        face.addQuadCurve(to: pt(60, 38), control: pt(81, 41)); face.closeSubpath()
        ctx.stroke(face, with: .color(ink.opacity(0.13)), lineWidth: 2)
        for (x, y, r, o) in [(60.0, 27.0, 1.5, 0.30), (48, 31, 1.2, 0.22), (72, 31, 1.2, 0.22), (31, 74, 1.3, 0.20),
                             (89, 74, 1.3, 0.20), (35, 86, 1.1, 0.18), (85, 86, 1.1, 0.18)] {
            ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r)), with: .color(ink.opacity(o)))
        }
        for (cx, r, pr, hx, hy, hr) in [(46.0, 13.5, 6.7, 49.5, 53.2, 2.4), (74, 11, 5.6, 76.8, 53.8, 2)] {
            ctx.fill(Path(ellipseIn: CGRect(x: cx - r, y: 57 - r, width: 2 * r, height: 2 * r)), with: .color(amber))
            ctx.fill(Path(ellipseIn: CGRect(x: cx - pr, y: 57 - pr, width: 2 * pr, height: 2 * pr)), with: .color(ink))
            ctx.fill(Path(ellipseIn: CGRect(x: hx - hr, y: hy - hr, width: 2 * hr, height: 2 * hr)), with: .color(.white))
        }
        var beak = Path()
        beak.move(to: pt(60, 67)); beak.addLine(to: pt(54.5, 72)); beak.addLine(to: pt(60, 78.5)); beak.addLine(to: pt(65.5, 72)); beak.closeSubpath()
        ctx.fill(beak, with: .color(amber))
        var st = Path()
        let star: [(CGFloat, CGFloat)] = [(0, -7), (1.6, -1.7), (7, 0), (1.6, 1.7), (0, 7), (-1.6, 1.7), (-7, 0), (-1.6, -1.7)]
        st.move(to: pt(60 + star[0].0, 94 + star[0].1))
        for q in star.dropFirst() { st.addLine(to: pt(60 + q.0, 94 + q.1)) }
        st.closeSubpath()
        ctx.fill(st, with: .color(Self.star))
    }
}

// MARK: - The panel (T1 "Night sky")

struct PanelActions {
    var open: (URL) -> Void = { _ in }
    var connect: () -> Void = {}
    var gear: () -> Void = {}
}

struct RoundButton<Content: View>: View {
    let label: String
    var enabled = true
    let action: () -> Void
    @ViewBuilder let content: () -> Content
    var body: some View {
        Button(action: action) {
            content()
                .frame(width: 36, height: 36)
                .overlay(Circle().strokeBorder(Night.control, lineWidth: 1))
                .contentShape(Circle())
        }
        .buttonStyle(NightButton(shape: Circle(), edge: Night.gold, hoverID: label))
        .foregroundColor(.white)
        .opacity(enabled ? 1 : 0.35)
        .disabled(!enabled)
        .help(label)
        .accessibilityLabel(label)
    }
}

struct CheckRing: View {
    let done: Int?
    let goal: Int
    let words: Words

    /// The artifact's ring: 58 across, a 7-wide band, a 44 inner circle.
    static let diameter: CGFloat = 58
    static let band: CGFloat = 7
    static var inner: CGFloat { diameter - 2 * band }
    /// Both lines sit in this box, inside the inner circle with room to spare at its corners (owner 2026-11-15:
    /// "7/5" and "check-ins" were touching the ring). The artifact's 15 and 8 pt are the most; they shrink to fit.
    static let textWidth: CGFloat = 30
    static let textHeight: CGFloat = 26
    static let countSize: CGFloat = 15
    static let captionSize: CGFloat = 8
    static let minScale: CGFloat = 0.5

    /// Over the goal the ring stays full and the count is shown as it is (7/5).
    static func fraction(_ done: Int?, _ goal: Int) -> Double { goal > 0 ? min(1, Double(done ?? 0) / Double(goal)) : 0 }

    var body: some View {
        ZStack {
            Circle().fill(Night.line)
            Pie(frac: Self.fraction(done, goal)).fill(Night.green)
            Circle().fill(Night.panel).frame(width: Self.inner, height: Self.inner)
            VStack(spacing: 1) {
                Text("\(done.map(String.init) ?? "–")/\(goal)")
                    .font(.system(size: Self.countSize, weight: .semibold))
                    .lineLimit(1).minimumScaleFactor(Self.minScale)
                Text(words.checkIns)
                    .font(.system(size: Self.captionSize, weight: .medium)).foregroundColor(Night.soft)
                    .lineLimit(1).minimumScaleFactor(Self.minScale)
            }
            .frame(width: Self.textWidth, height: Self.textHeight)
            .foregroundColor(.white)
        }
        .frame(width: Self.diameter, height: Self.diameter)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(words.ringLabel(done, goal))
    }
    /// conic-gradient(green 0 frac, track frac 100%): from 12 o'clock, clockwise.
    struct Pie: Shape {
        let frac: Double
        func path(in r: CGRect) -> Path {
            guard frac > 0 else { return Path() }
            var p = Path()
            let c = CGPoint(x: r.midX, y: r.midY)
            p.move(to: c)
            p.addArc(center: c, radius: r.width / 2, startAngle: .degrees(-90), endAngle: .degrees(-90 + 360 * frac), clockwise: false)
            p.closeSubpath()
            return p
        }
    }
}

struct DayStamp: View {
    let day: MacPanel.Week.Day
    var body: some View {
        let n = UKDay.dayOfMonth(day.day)
        HStack(spacing: 1) {
            Text(n)
            if day.test { Text("◆").font(.system(size: 6)).foregroundColor(Night.test) }
        }
        .font(.system(size: 11, weight: day.checkedIn || day.isToday ? .semibold : .regular))
        .foregroundColor(day.checkedIn || day.isToday || day.test ? .white : Night.soft)
        .frame(width: 32, height: 32)
        .background(Circle().fill(day.checkedIn ? Night.green : Color.clear))
        .overlay(
            Group {
                if day.isToday {
                    Circle().strokeBorder(Night.gold, style: StrokeStyle(lineWidth: 2, dash: [4, 3]))
                } else if !day.checkedIn {
                    Circle().strokeBorder(Night.stamp, lineWidth: 1)
                }
            }
        )
    }
}

struct BoxHeading: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .semibold))
            .tracking(1.4)
            .foregroundColor(Night.gold)
            .padding(.horizontal, 10).padding(.top, 6).padding(.bottom, 2)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct Box<Content: View>: View {
    @ViewBuilder let content: () -> Content
    var body: some View {
        VStack(spacing: 0, content: content)
            .padding(.vertical, 6).padding(.horizontal, 4)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Night.line, lineWidth: 1))
            .padding(.horizontal, 12)
    }
}

struct Tickbox: View {
    let on: Bool
    /// Doing: a blue ring with a dot, not a box (M15).
    var doing = false
    @Environment(\.nightHover) private var hover
    var body: some View {
        if doing {
            Circle().strokeBorder(Night.doing, lineWidth: 2)
                .overlay(Circle().fill(Night.doing).frame(width: 6, height: 6))
                .frame(width: 14, height: 14)
        } else {
            box
        }
    }
    private var box: some View {
        // As the artifact draws them: a white box, ticked in the system accent (blue by default).
        RoundedRectangle(cornerRadius: 3)
            .fill(on ? Color.accentColor : Color.white)
            .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(on ? Color.accentColor : hover ? Night.gold : Night.faint, lineWidth: hover && !on ? 1.5 : 0.5))
            .overlay(
                Path { p in p.move(to: CGPoint(x: 3.5, y: 7)); p.addLine(to: CGPoint(x: 6, y: 9.5)); p.addLine(to: CGPoint(x: 10.5, y: 4)) }
                    .stroke(Color.white, style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round))
                    .opacity(on ? 1 : 0)
            )
            .frame(width: 14, height: 14)
            .animation(Lift.ease, value: hover)
    }
}

struct FieldWithPlaceholder: View {
    @Binding var text: String
    let placeholder: String
    var onSubmit: () -> Void
    var focus: FocusState<Bool>.Binding? = nil
    /// Esc in the box.
    var onExit: (() -> Void)? = nil
    var body: some View {
        ZStack(alignment: .leading) {
            if text.isEmpty {
                Text(placeholder).foregroundColor(Night.faint).lineLimit(1).allowsHitTesting(false)
            }
            if let focus {
                field.focused(focus)
            } else {
                field
            }
        }
        .font(.system(size: 14))
    }
    private var field: some View {
        TextField("", text: $text)
            .textFieldStyle(.plain)
            .foregroundColor(.white)
            .onSubmit(onSubmit)
            .onExitCommand { onExit?() }
    }
}

struct Shortcut: View {
    let title: String
    let icon: Icon24
    var badge: Int? = nil
    var label: String? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                icon.line(1.8, size: 20).frame(width: 20, height: 20)
                Text(title).font(.system(size: 9))
            }
            .frame(width: 48, height: 46)
            .overlay(alignment: .topTrailing) {
                if let badge, badge > 0 {
                    Text(badge > 99 ? "99+" : String(badge))
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 4)
                        .frame(minWidth: 16, minHeight: 16)
                        .background(Capsule().fill(Night.green))
                        .offset(x: -2, y: 1)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(NightButton(shape: RoundedRectangle(cornerRadius: 8), hoverID: "shortcut:\(title)"))
        .foregroundColor(.white)
        .help(label ?? title)
        .accessibilityLabel(label ?? title)
    }
}

struct PanelView: View {
    @ObservedObject var store: PanelStore
    var actions = PanelActions()
    @FocusState private var lineFocused: Bool
    @FocusState private var addFocused: Bool
    @FocusState private var askFocused: Bool
    @Environment(\.panelPreviewNow) private var previewNow
    @State private var eyesHover = false

    private var w: Words { store.words }

    var body: some View {
        VStack(spacing: 0) {
            header
            if let p = store.panel, store.connected {
                stamps(p)
                todayBox(p)
                todoBox(p).padding(.top, 10)
                eveningRow(p).padding(.top, 10)
                if let n = store.notice { noticeText(n) }
            } else {
                connectBox
            }
            if !store.reachable && store.connected && store.panel == nil { noticeText(w.offline) }
            shortcuts.padding(.top, 12)
        }
        .frame(width: 380)
        .background(Night.panel)
        .foregroundColor(.white)
        .environment(\.colorScheme, .dark)
    }

    // ── WEEK 46 · 9–15 NOV, ‹ Today · Sat 14 › ⤢, and the ring
    var header: some View {
        let week = store.panel.map { (no: $0.week.no, range: $0.week.range) } ?? UKDay.localWeek(store.lang)
        return HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 10) {
                Text(w.week(week.no, week.range))
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .tracking(1.9)
                    .foregroundColor(Night.gold)
                if store.connected, store.panel != nil { dayNav }
            }
            Spacer(minLength: 4)
            if let p = store.panel, store.connected {
                CheckRing(done: p.week.checkIns, goal: p.week.goal, words: w)
            }
        }
        .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 12)
    }

    private var dayNav: some View {
        HStack(spacing: 6) {
            RoundButton(label: w.previousDay, enabled: store.canMove(-1), action: { store.move(-1) }) {
                Icons.back.line(2.2, size: 14).frame(width: 14, height: 14)
            }
            Button(action: store.goToday) {
                // ONE line, always (owner 2026-11-15: "Tomorro / w" wrapped). The word never wraps or truncates;
                // when the row is tight the date part shrinks first.
                HStack(spacing: 6) {
                    Text(pill.word).font(.system(size: 14, weight: .semibold))
                        .lineLimit(1).fixedSize(horizontal: true, vertical: false).layoutPriority(2)
                    Text("· " + pill.rest).font(.system(size: 14)).foregroundColor(Night.soft)
                        .lineLimit(1).minimumScaleFactor(0.7).layoutPriority(1)
                }
                .padding(.horizontal, 14)
                .frame(height: 36)
                .background(Capsule().fill(Night.pill))
                .overlay(Capsule().strokeBorder(Night.control, lineWidth: 1))
                .contentShape(Capsule())
            }
            .buttonStyle(NightButton(shape: Capsule(), edge: Night.gold, hoverID: "pill"))
            .accessibilityLabel(pill.word + ", " + pill.rest)
            RoundButton(label: w.nextDay, enabled: store.canMove(1), action: { store.move(1) }) {
                Icons.forward.line(2.2, size: 14).frame(width: 14, height: 14)
            }
            RoundButton(label: w.openCalendar, action: { actions.open(store.link("/study/calendar")) }) {
                Icons.expand.line(2.2, size: 14).frame(width: 14, height: 14)
            }
        }
    }

    private var pill: (word: String, rest: String) {
        guard let p = store.panel else { return (w.today, "") }
        return UKDay.pill(p.day, today: p.today, w)
    }

    private func stamps(_ p: MacPanel) -> some View {
        HStack(spacing: 6) {
            ForEach(Array(p.week.days.enumerated()), id: \.offset) { i, d in
                VStack(spacing: 5) {
                    Text(i < w.dayLetters.count ? w.dayLetters[i] : "")
                        .font(.system(size: 11)).foregroundColor(Night.soft)
                    Button(action: { store.show(d.day) }) { DayStamp(day: d) }
                        .buttonStyle(NightButton(shape: Circle(), edge: Night.gold, hoverID: "stamp:\(d.day)"))
                        .disabled(!store.canShow(d.day))
                        .help(UKDay.short(d.day, store.lang))
                        .accessibilityLabel(UKDay.short(d.day, store.lang))
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 14).padding(.bottom, 14)
    }

    // ── TODAY: the day's items with time and colour dot, then the next test (◆)
    private func todayBox(_ p: MacPanel) -> some View {
        Box {
            BoxHeading(text: p.day == p.today ? w.todayBox : UKDay.short(p.day, store.lang).uppercased())
            ForEach(p.items) { item in
                row(time: item.time ?? w.allDay) {
                    Circle().fill(Color(css: item.colour) ?? Night.dot).frame(width: 8, height: 8)
                } title: { Text(item.title) }
            }
            if let t = p.nextTest, t.day != p.day {
                row(time: UKDay.weekdayName(t.day, store.lang)) {
                    Rectangle().fill(Night.test).frame(width: 8, height: 8).rotationEffect(.degrees(45))
                } title: { Text(t.title) }
            }
            if p.items.isEmpty && (p.nextTest == nil || p.nextTest?.day == p.day) {
                Text(w.nothingToday).font(.system(size: 13)).foregroundColor(Night.faint)
                    .padding(.horizontal, 10).padding(.vertical, 8).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func row<Mark: View>(time: String, @ViewBuilder mark: () -> Mark, @ViewBuilder title: () -> Text) -> some View {
        HStack(spacing: 10) {
            Text(time).font(.system(size: 12)).foregroundColor(Night.soft).frame(width: 40, alignment: .leading).lineLimit(1)
            mark()
            title().font(.system(size: 14)).lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
    }

    // ── TO-DO (M15, design B): five rows, Doing first; each row's pill cycles To do → Doing → Done. "N open · M done"
    // in the heading; "+ Add a to-do" and "All N in My calendar ↗" on the last line. The box never grows past five.
    func todoBox(_ p: MacPanel) -> some View {
        let rows = store.todoRows
        return Box {
            BoxHeading(text: w.todoBox)
                .overlay(alignment: .trailing) {
                    Text(w.todoCounts(p.openTodos, p.doneToday ?? 0))
                        .font(.system(size: 11, weight: .medium, design: .monospaced)).foregroundColor(Night.soft)
                        .lineLimit(1).padding(.trailing, 10).padding(.top, 4)
                }
            todoRows(rows)
            if rows.isEmpty && !store.addingTodo {
                Text(w.noTodos).font(.system(size: 13)).foregroundColor(Night.faint)
                    .padding(.horizontal, 10).padding(.vertical, 8).frame(maxWidth: .infinity, alignment: .leading)
            }
            if store.addingTodo { addField }
            HStack(spacing: 0) {
                if !store.addingTodo {
                    textButton(w.addTodo, id: "add") { store.addingTodo = true }
                }
                Spacer(minLength: 0)
                textButton(w.allInCalendar(p.openTodos), id: "all", colour: Night.gold) { actions.open(store.link("/study/calendar")) }
            }
            if store.addedNote {
                Text(w.added).font(.system(size: 12)).foregroundColor(Night.mint)
                    .padding(.horizontal, 10).padding(.bottom, 4).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func todoRows(_ rows: [TodoRow]) -> some View {
        VStack(spacing: 0) {
            ForEach(rows) { row in
                switch row {
                case .checkIn(let done): checkInRow(done)
                case .todo(let t): todoRow(t)
                }
            }
        }
        .animation(.easeInOut(duration: TodoList.slide), value: rows.map(\.id))
    }

    private func checkInRow(_ done: Bool) -> some View {
        Button(action: { if !done { lineFocused = true } }) {
            HStack(spacing: 10) {
                Tickbox(on: done)
                Text(w.checkInToday).font(.system(size: 14)).strikethrough(done).lineLimit(1)
                    .foregroundColor(done ? Night.faint : .white)
                Spacer(minLength: 0)
                if !done {
                    Text(w.checkInPoints(PanelStore.checkInPoints)).font(.system(size: 12)).foregroundColor(Night.mint)
                }
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(NightButton(shape: RoundedRectangle(cornerRadius: 6), amount: Lift.row, hoverID: "checkin"))
        .disabled(done)
    }

    private func todoRow(_ t: MacPanel.Todo) -> some View {
        HStack(spacing: 6) {
            // The box (and the title beside it) ticks it done.
            Button(action: { store.toggle(t) }) {
                HStack(spacing: 10) {
                    Tickbox(on: t.state == "done", doing: t.state == "doing")
                    Text(t.title).font(.system(size: 14)).lineLimit(1).truncationMode(.tail)
                        .foregroundColor(.white)
                    Spacer(minLength: 0)
                }
                .padding(.leading, 10).padding(.trailing, 4).padding(.vertical, 8)
                .contentShape(Rectangle())
            }
            .buttonStyle(NightButton(shape: RoundedRectangle(cornerRadius: 6), amount: Lift.row, hoverID: "todo:\(t.id)"))
            statusPill(t)
        }
        .padding(.trailing, 10)
    }

    /// The row's pill: its status in the board's words; one click moves it on (To do → Doing → Done).
    private func statusPill(_ t: MacPanel.Todo) -> some View {
        let s = t.state
        let tint = s == "doing" ? Night.doing : s == "done" ? Night.mint : Night.soft
        return Button(action: { store.cycle(t) }) {
            Text(w.status(s))
                .font(.system(size: 11, weight: .medium, design: .monospaced)).foregroundColor(tint)
                .lineLimit(1).fixedSize()
                .padding(.horizontal, 8).padding(.vertical, 1)
                .overlay(Capsule().strokeBorder(s == "todo" ? Night.line : tint, lineWidth: 1))
                .contentShape(Capsule())
        }
        .buttonStyle(NightButton(shape: Capsule(), amount: Lift.row, hoverID: "pill:\(t.id)"))
        .help(w.pillHelp)
        .accessibilityLabel(w.pillLabel(t.title, w.status(s)))
    }

    /// The small text buttons on the box's last line ("+ Add a to-do" in mint, "All N in My calendar ↗" in gold).
    private func textButton(_ title: String, id: String, colour: Color = Night.mint, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.system(size: 13, weight: .semibold)).foregroundColor(colour).lineLimit(1)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .contentShape(Rectangle())
        }
        .buttonStyle(NightButton(shape: RoundedRectangle(cornerRadius: 6), amount: Lift.row, hoverID: id))
    }

    /// The new to-do box: Return adds, Esc or ✕ cancels, clicking away from an EMPTY box closes it.
    private var addField: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 10) {
                Tickbox(on: false)
                FieldWithPlaceholder(text: $store.newTodo, placeholder: w.addTodoPlaceholder, onSubmit: { store.addTodo() },
                                     focus: $addFocused, onExit: store.cancelAdd)
                    .hoverCursor(.iBeam)
                    .disabled(store.addInFlight)
                Button(action: store.cancelAdd) {
                    Icons.close.line(2, size: 12).frame(width: 12, height: 12)
                        .frame(width: 24, height: 24).contentShape(Rectangle())
                }
                .buttonStyle(NightButton(shape: RoundedRectangle(cornerRadius: 6), hoverID: "cancel-add"))
                .foregroundColor(Night.soft)
                .help(w.cancelAdd)
                .accessibilityLabel(w.cancelAdd)
            }
            .padding(.leading, 10).padding(.trailing, 4).padding(.vertical, 4)
            if let e = store.addError {
                Text(e).font(.system(size: 12)).foregroundColor(Night.test)
                    .padding(.leading, 34).padding(.bottom, 4)
            }
        }
        .onAppear { DispatchQueue.main.async { addFocused = true } }
        .onChange(of: addFocused) { _, focused in if !focused { store.blurAdd() } }
    }

    // ── The row under the to-dos: Mentor's composer on today before lineOpensHour (21:00), Tonight's line otherwise.
    // It flips at 21:00 (and at midnight) while the panel is open: the timeline wakes exactly then, it does not poll.
    // The clock is read when the timeline wakes (Date()), not from the entry's date: before the first entry fires,
    // what a TimelineView reports as its date is not something to build the 21:00 rule on.
    func eveningRow(_ p: MacPanel) -> some View {
        TimelineView(.explicit(MentorComposer.flips(after: Date()))) { _ in
            if MentorComposer.showsLine(isToday: p.day == p.today, now: previewNow ?? Date()) {
                lineRow(p)
            } else {
                mentorRow(p)
            }
        }
    }

    /// Mentor's crest + one box, the line row's size and box. Enter opens the room on aitutors.me; empty does nothing.
    func mentorRow(_ p: MacPanel) -> some View {
        HStack(spacing: 8) {
            MentorCrest()
                .frame(width: 26, height: 26)
                .frame(width: 44, height: 40)
                .background(RoundedRectangle(cornerRadius: 10).fill(Night.field))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Night.control, lineWidth: 1))
                .help(w.mentor)
            FieldWithPlaceholder(
                text: $store.askText,
                placeholder: w.askMentorPlaceholder,
                onSubmit: {
                    guard let url = MentorComposer.askURL(store.askText, day: p.today, base: store.link("/study/calendar")) else { return }
                    store.askText = ""
                    actions.open(url)
                },
                focus: $askFocused
            )
            .padding(.horizontal, 12)
            .frame(height: 40)
            .background(RoundedRectangle(cornerRadius: 10).fill(Night.field))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Night.control, lineWidth: 1))
            .modifier(FieldHover(enabled: true, focused: askFocused, hoverID: "ask"))
            .accessibilityLabel(w.askMentorPlaceholder)
        }
        .padding(.horizontal, 12)
    }

    // ── Tonight's line: ONE row. Heddy's eyes (tap = her mood) + the line + "+2". No lens, no heading.
    private func lineRow(_ p: MacPanel) -> some View {
        let written = p.line.state == "written"
        let forToday = store.lineIsForToday
        return HStack(spacing: 8) {
            Button(action: store.cycleMood) {
                HeddyEyes(mood: store.mood, animating: store.eyesAnimating,
                          lookUp: eyesHover && !store.reduceMotion, blinkAt: store.blinkAt)
                    .frame(width: 32, height: 19)
                    .frame(width: 44, height: 40)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Night.field))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Night.control, lineWidth: 1))
                    .contentShape(Rectangle())
            }
            .buttonStyle(NightButton(shape: RoundedRectangle(cornerRadius: 10), edge: Night.gold, hoverID: "eyes"))
            .onHover { eyesHover = $0 }
            .help(w.moodButton(w.mood(store.mood ?? "calm")))
            .accessibilityLabel(w.moodButton(w.mood(store.mood ?? "calm")))
            FieldWithPlaceholder(
                text: $store.lineText,
                placeholder: !forToday ? w.lineNotToday : written ? w.lineKept : w.linePlaceholder,
                onSubmit: store.sendLine,
                focus: $lineFocused
            )
            .disabled(!forToday)
            .padding(.horizontal, 12)
            .frame(height: 40)
            .background(RoundedRectangle(cornerRadius: 10).fill(Night.field))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Night.control, lineWidth: 1))
            .modifier(FieldHover(enabled: forToday, focused: lineFocused, hoverID: "line"))
            if !written {
                Text("+2").font(.system(size: 12)).foregroundColor(Night.mint).fixedSize()
            }
        }
        .padding(.horizontal, 12)
    }

    private func noticeText(_ s: String) -> some View {
        Text(s).font(.system(size: 12)).foregroundColor(Night.soft)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 16).padding(.top, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // ── Signed out: the week line, Connect, and the shortcuts only
    private var connectBox: some View {
        Box {
            VStack(alignment: .leading, spacing: 12) {
                Text(w.connectBlurb).font(.system(size: 13)).foregroundColor(Night.soft)
                    .fixedSize(horizontal: false, vertical: true)
                Button(action: actions.connect) {
                    Text(store.connecting ? w.connecting : w.connect)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Night.panel)
                        .padding(.horizontal, 16).frame(height: 36)
                        .background(Capsule().fill(Night.gold))
                        .contentShape(Capsule())
                }
                .buttonStyle(NightButton(shape: Capsule(), amount: 0.16, hoverID: "connect"))
                .disabled(store.connecting)
                if let e = store.connectError {
                    Text(e).font(.system(size: 12)).foregroundColor(Night.test)
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // ── Home, Jotters, Cards (due), Clips, Exams, Tutors; the gear on the right
    /// The tile at the shortcut row's scale: as tall as a shortcut's icon + label (20 + 3 + 11), level with them.
    static let mascotSize: CGFloat = 32

    var shortcuts: some View {
        let cards = store.connected ? store.panel?.cardsDue : nil
        return HStack(spacing: 2) {
            Shortcut(title: w.home, icon: Icons.home) { actions.open(store.link("/study")) }
            Shortcut(title: w.jotters, icon: Icons.jotters) { actions.open(store.link("/study/jotters")) }
            Shortcut(title: w.cards, icon: Icons.cards, badge: cards, label: cards.map { $0 > 0 ? w.cardsDue($0) : w.cards }) {
                actions.open(store.link("/study/cards"))
            }
            Shortcut(title: w.clips, icon: Icons.clips) { actions.open(store.link("/study/clips")) }
            Shortcut(title: w.exams, icon: Icons.exams) { actions.open(store.link("/study/exam")) }
            Shortcut(title: w.tutors, icon: Icons.tutors) { actions.open(store.link("/study/tutor")) }
            Spacer(minLength: 0)
            // heddy.app's mascot in place of the gear; the menu behind it is unchanged.
            Button(action: actions.gear) {
                HeddyMascot(size: Self.mascotSize)
                    .frame(width: 44, height: 46).contentShape(Rectangle())
            }
            .buttonStyle(NightButton(shape: RoundedRectangle(cornerRadius: 8), hoverID: "gear"))
            .help(w.heddyMenu)
            .accessibilityLabel(w.heddyMenu)
        }
        .padding(8)
        .background(Night.bar)
        .overlay(alignment: .top) { Rectangle().fill(Night.line).frame(height: 1) }
    }
}

// MARK: - The welcome sheet (M11: open at login, PRE-TICKED; Apple 2.4.5 consent is the one click on Start)

struct WelcomeView: View {
    let words: Words
    @State var openAtLogin = true
    var start: (Bool) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                Image(nsImage: Owl.image(height: 26)).renderingMode(.template).foregroundColor(Night.gold)
                Text(words.welcomeTitle).font(.system(size: 17, weight: .semibold))
            }
            Text(words.welcomeBody).font(.system(size: 13)).foregroundColor(Night.soft)
                .fixedSize(horizontal: false, vertical: true)
            Toggle(isOn: $openAtLogin) { Text(words.openAtLogin).font(.system(size: 13)) }
                .toggleStyle(.checkbox)
            HStack {
                Spacer()
                Button(words.start) { start(openAtLogin) }
                    .keyboardShortcut(.defaultAction)
                    .controlSize(.large)
            }
        }
        .padding(24)
        .frame(width: 400)
        .background(Night.panel)
        .foregroundColor(.white)
        .environment(\.colorScheme, .dark)
    }
}

// MARK: - The app

@main
class AppDelegate: NSObject, NSApplicationDelegate, NSPopoverDelegate, ASWebAuthenticationPresentationContextProviding {

    private var statusItem: NSStatusItem!
    private let popover = NSPopover()
    private let store = PanelStore()
    private var timer: Timer?
    private var bag = Set<AnyCancellable>()
    private var authSession: ASWebAuthenticationSession?
    /// The converter's "Turn on Heddy in Safari" window, kept so the gear can bring it back.
    private var mainWindowController: NSWindowController?
    private var welcomeWindow: NSWindow?
    /// Set only by Quit (gear or ⌘Q): every other terminate keeps Heddy in the menu bar (M12).
    private var quitRequested = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        let atLogin = Self.launchedAsLoginItem()

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = Owl.image()
            button.imagePosition = .imageLeading
            button.target = self
            button.action = #selector(togglePanel(_:))
            button.setAccessibilityLabel("Heddy")
        }
        store.$panel.combineLatest(store.$token)
            .receive(on: RunLoop.main)
            .sink { [weak self] _, _ in self?.updateBadge() }
            .store(in: &bag)

        popover.behavior = .transient
        popover.delegate = self
        popover.animates = true
        popover.appearance = NSAppearance(named: .darkAqua)
        popover.hasFullSizeContent = true
        let host = NSHostingController(rootView: PanelView(store: store, actions: panelActions()))
        host.sizingOptions = .preferredContentSize
        popover.contentViewController = host

        // The converter's window: keep it, and know when it closes (M12).
        if let w = NSApp.windows.first(where: { $0.contentViewController is ViewController }) {
            w.isReleasedWhenClosed = false
            mainWindowController = w.windowController
        }
        NotificationCenter.default.addObserver(self, selector: #selector(anyWindowWillClose(_:)), name: NSWindow.willCloseNotification, object: nil)
        rewireQuitMenuItem()

        timer = Timer.scheduledTimer(withTimeInterval: HeddyMac.refreshEvery, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.store.refresh() }
        }
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(didWake(_:)), name: NSWorkspace.didWakeNotification, object: nil)
        Task { await store.refresh() }

        if !UserDefaults.standard.bool(forKey: HeddyMac.welcomeShownKey) {
            NSApp.setActivationPolicy(.regular)
            showWelcome()
        } else if atLogin {
            // Opened at login: just the owl, no window and no Dock icon.
            mainWindowController?.window?.orderOut(nil)
            NSApp.setActivationPolicy(.accessory)
        } else {
            NSApp.setActivationPolicy(.regular)
        }
    }

    // M12: the menu bar keeps running when the last window closes.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }

    /// The converter's ViewController quits the app after opening Safari's settings. Heddy stays in the menu bar
    /// instead: only Quit (gear or ⌘Q), the Dock's Quit, and log out / shut down (both Apple events) end her.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if quitRequested { return .terminateNow }
        if let ev = NSAppleEventManager.shared().currentAppleEvent, ev.eventClass == kCoreEventClass, ev.eventID == kAEQuitApplication {
            return .terminateNow
        }
        for w in NSApp.windows where w.isVisible && w.styleMask.contains(.titled) { w.close() }
        NSApp.setActivationPolicy(.accessory)
        return .terminateCancel
    }

    /// Clicking the Dock icon brings the window back.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { showMainWindow() }
        return false
    }

    // MARK: menu bar

    private func updateBadge() {
        guard let button = statusItem?.button else { return }
        let n = store.openTodos
        button.title = n > 0 ? " \(n)" : ""
        button.setAccessibilityLabel(n > 0 ? "Heddy, \(n) to-dos" : "Heddy")
    }

    @objc private func togglePanel(_ sender: Any?) {
        if popover.isShown { popover.performClose(sender); return }
        showPanel()
    }

    private func showPanel() {
        guard let button = statusItem.button else { return }
        NSApp.activate(ignoringOtherApps: true)
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        popover.contentViewController?.view.window?.makeKey()
        Task { await store.refresh() }
    }

    // The eyes run only while the panel is on screen; Reduce Motion is read each time it opens.
    func popoverWillShow(_ notification: Notification) {
        store.reduceMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        store.screenHeight = statusItem.button?.window?.screen?.visibleFrame.height ?? NSScreen.main?.visibleFrame.height ?? 800
        store.panelVisible = true
    }

    func popoverDidClose(_ notification: Notification) {
        store.panelVisible = false
    }

    @objc private func didWake(_ note: Notification) {
        Task { await store.refresh() }
    }

    private func panelActions() -> PanelActions {
        PanelActions(
            open: { [weak self] url in
                self?.popover.performClose(nil)
                NSWorkspace.shared.open(url)
            },
            connect: { [weak self] in self?.connect() },
            gear: { [weak self] in self?.showGearMenu() }
        )
    }

    // MARK: the gear: Turn on Heddy in Safari, Open at login, Disconnect, Quit

    private func showGearMenu() {
        let w = store.words
        let menu = NSMenu()
        menu.addItem(withTitle: w.turnOnInSafari, action: #selector(turnOnInSafari), keyEquivalent: "").target = self
        let login = menu.addItem(withTitle: w.openAtLogin, action: #selector(toggleOpenAtLogin), keyEquivalent: "")
        login.target = self
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off
        if store.connected {
            menu.addItem(.separator())
            menu.addItem(withTitle: w.disconnect, action: #selector(disconnect), keyEquivalent: "").target = self
        }
        menu.addItem(.separator())
        menu.addItem(withTitle: w.quit, action: #selector(quitHeddy), keyEquivalent: "q").target = self
        menu.popUp(positioning: nil, at: NSEvent.mouseLocation, in: nil)
    }

    @objc private func turnOnInSafari() {
        popover.performClose(nil)
        showMainWindow()
    }

    @objc private func toggleOpenAtLogin() {
        setOpenAtLogin(SMAppService.mainApp.status != .enabled)
    }

    private func setOpenAtLogin(_ on: Bool) {
        do {
            if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
        } catch {
            NSLog("Heddy: open at login %@ failed: %@", on ? "on" : "off", error.localizedDescription)
        }
        if on && SMAppService.mainApp.status == .requiresApproval { SMAppService.openSystemSettingsLoginItems() }
    }

    @objc private func disconnect() {
        store.signOut()
    }

    @objc private func quitHeddy() {
        quitRequested = true
        NSApp.terminate(nil)
    }

    /// The storyboard's "Quit Heddy" (⌘Q) goes through quitHeddy, so it really quits.
    private func rewireQuitMenuItem() {
        func walk(_ menu: NSMenu?) {
            for item in menu?.items ?? [] {
                if item.action == #selector(NSApplication.terminate(_:)) {
                    item.action = #selector(quitHeddy)
                    item.target = self
                }
                walk(item.submenu)
            }
        }
        walk(NSApp.mainMenu)
    }

    // MARK: windows and the Dock (M12)

    private func showMainWindow() {
        NSApp.setActivationPolicy(.regular)
        if mainWindowController == nil,
           let wc = NSStoryboard(name: "Main", bundle: nil).instantiateInitialController() as? NSWindowController {
            wc.window?.isReleasedWhenClosed = false
            mainWindowController = wc
        }
        (mainWindowController?.contentViewController as? ViewController)?.webView?.reload()
        mainWindowController?.showWindow(nil)
        mainWindowController?.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func anyWindowWillClose(_ note: Notification) {
        guard let closing = note.object as? NSWindow, closing.styleMask.contains(.titled), closing.sheetParent == nil else { return }
        DispatchQueue.main.async {
            let others = NSApp.windows.contains { $0 !== closing && $0.isVisible && $0.styleMask.contains(.titled) && $0.sheetParent == nil }
            if !others { NSApp.setActivationPolicy(.accessory) }
        }
    }

    // MARK: first launch (M11)

    private func showWelcome() {
        let view = WelcomeView(words: store.words) { [weak self] openAtLogin in self?.finishWelcome(openAtLogin) }
        let sheet = NSWindow(contentViewController: NSHostingController(rootView: view))
        sheet.styleMask = [.titled]
        sheet.appearance = NSAppearance(named: .darkAqua)
        welcomeWindow = sheet
        if let parent = mainWindowController?.window {
            parent.makeKeyAndOrderFront(nil)
            parent.beginSheet(sheet)
        } else {
            sheet.center()
            sheet.makeKeyAndOrderFront(nil)
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    private func finishWelcome(_ openAtLogin: Bool) {
        UserDefaults.standard.set(true, forKey: HeddyMac.welcomeShownKey)
        if openAtLogin != (SMAppService.mainApp.status == .enabled) { setOpenAtLogin(openAtLogin) }
        if let sheet = welcomeWindow {
            if let parent = sheet.sheetParent { parent.endSheet(sheet) } else { sheet.close() }
        }
        welcomeWindow = nil
        // Show her where Heddy lives now: the panel drops from the owl (Connect, when not yet connected).
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in self?.showPanel() }
    }

    private static func launchedAsLoginItem() -> Bool {
        guard let ev = NSAppleEventManager.shared().currentAppleEvent, ev.eventID == kAEOpenApplication else { return false }
        return ev.paramDescriptor(forKeyword: keyAEPropData)?.enumCodeValue == keyAELaunchedAsLogInItem
    }

    // MARK: connect (ASWebAuthenticationSession + PKCE → POST /api/heddy/mac/token)

    private func connect() {
        guard authSession == nil else { return }
        let verifier = PKCE.verifier()
        let state = PKCE.state()
        var c = URLComponents(url: store.link("/heddy-chrome/mac-connect"), resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "state", value: state), URLQueryItem(name: "challenge", value: PKCE.challenge(verifier))]
        guard let url = c.url else { return }
        store.setConnecting(true)
        let session = ASWebAuthenticationSession(url: url, callback: .customScheme(HeddyMac.callbackScheme)) { [weak self] callback, error in
            Task { @MainActor in self?.finishConnect(callback: callback, error: error, state: state, verifier: verifier) }
        }
        session.presentationContextProvider = self
        // Reuse the browser's aitutors.me sign-in: a child already signed in sees one button.
        session.prefersEphemeralWebBrowserSession = false
        authSession = session
        popover.performClose(nil)
        if !session.start() {
            authSession = nil
            store.connectFailed()
        }
    }

    private func finishConnect(callback: URL?, error: Error?, state: String, verifier: String) {
        authSession = nil
        if let e = error as? ASWebAuthenticationSessionError, e.code == .canceledLogin {
            store.setConnecting(false)
            return
        }
        guard let callback, callback.scheme == HeddyMac.callbackScheme,
              let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems,
              items.first(where: { $0.name == "state" })?.value == state,
              let code = items.first(where: { $0.name == "code" })?.value else {
            store.connectFailed()
            showPanel()
            return
        }
        Task {
            if let token = await store.api.swap(code: code, verifier: verifier) {
                store.connected(token)
            } else {
                store.connectFailed()
            }
            showPanel()
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApp.keyWindow ?? mainWindowController?.window ?? NSApp.windows.first ?? ASPresentationAnchor()
    }
}
