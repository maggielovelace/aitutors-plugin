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
    var todos: [Todo]
    var openTodos: Int
    /// nil when unread: no badge, never a false 0.
    let cardsDue: Int?
    var line: Line
}

private struct PanelEnvelope: Decodable {
    let type: String
    let panel: MacPanel?
}

private struct TypeEnvelope: Decodable {
    let type: String?
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
    case ok(points: Int)
    case safeguarding(String)
    case closed
    case signedOut
    case failed
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

    func write(_ path: String, token: String, body: [String: Any]) async -> WriteOutcome {
        guard let (data, res) = try? await session.data(for: request(url(path), method: "POST", token: token, body: body)),
              let http = res as? HTTPURLResponse else { return .failed }
        if http.statusCode == 401 { return .signedOut }
        let env = (try? JSONDecoder().decode(TypeEnvelope.self, from: data))
        let points = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["points"] as? Int ?? 0
        switch env?.type {
        case "ok": return .ok(points: points)
        case "safeguarding": return .safeguarding(env?.message ?? "If you're struggling, please talk to a parent or call Childline 0800 1111")
        case "window-closed": return .closed
        default: return .failed
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
    @Published var addingTodo = false
    @Published var newTodo = ""
    /// The day ‹ › has moved to; nil = today.
    @Published private(set) var viewDay: String?

    let lang = Lang.system
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
        let next = UKDay.add(p.day, n)
        viewDay = next == p.today ? nil : next
        notice = nil
        Task { await refresh() }
    }
    func goToday() {
        guard viewDay != nil else { return }
        viewDay = nil
        Task { await refresh() }
    }

    // MARK: writing

    func toggle(_ todo: MacPanel.Todo) {
        guard let t = token, var p = panel, let i = p.todos.firstIndex(where: { $0.id == todo.id }) else { return }
        let before = p
        p.todos[i].done.toggle()
        p.openTodos = max(0, p.openTodos + (p.todos[i].done ? -1 : 1))
        panel = p
        let status = p.todos[i].done ? "done" : "todo"
        Task {
            let r = await api.write("/api/heddy/mac/todo", token: t.token, body: ["op": "status", "id": todo.id, "status": status])
            handleWrite(r, revert: before)
            await refresh()
        }
    }

    func addTodo() {
        let title = newTodo.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let t = token, !title.isEmpty else { addingTodo = false; return }
        newTodo = ""
        addingTodo = false
        Task {
            let r = await api.write("/api/heddy/mac/todo", token: t.token, body: ["op": "add", "title": title])
            handleWrite(r, revert: nil)
            await refresh()
        }
    }

    func cycleMood() {
        let order = ["calm", "bright", "sleepy", "wobbly"]
        let i = order.firstIndex(of: mood ?? "calm") ?? 0
        mood = mood == nil ? "bright" : order[(i + 1) % order.count]
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

    private struct Eye { let cx, cy, r, pr, hx, hy, hr: CGFloat }
    private static let left = Eye(cx: 46, cy: 57, r: 13.5, pr: 6.7, hx: 49.5, hy: 53.2, hr: 2.4)
    private static let right = Eye(cx: 74, cy: 57, r: 11, pr: 5.6, hx: 76.8, hy: 53.8, hr: 2)
    private static let box = CGRect(x: 30.6, y: 39.6, width: 57.7, height: 34.6)

    var body: some View {
        Canvas { ctx, size in
            // The artifact's 30×18 eyes are this geometry at 0.52: left iris r7 at (8, 9), right r6 at (22.5, 9.5).
            let s = size.width / Self.box.width
            ctx.scaleBy(x: s, y: s)
            ctx.translateBy(x: -Self.box.minX, y: -Self.box.minY)
            let m = mood ?? "calm"
            if m == "bright" {
                for (a, b) in [(37.0, 57.0), (63.0, 83.0)] {
                    var p = Path()
                    p.move(to: CGPoint(x: a, y: 58)); p.addQuadCurve(to: CGPoint(x: b, y: 58), control: CGPoint(x: (a + b) / 2, y: 47))
                    ctx.stroke(p, with: .color(Night.amber), style: StrokeStyle(lineWidth: 3.6, lineCap: .round))
                }
                return
            }
            let (dx, dy, frac, slope): (CGFloat, CGFloat, CGFloat, CGFloat) =
                m == "sleepy" ? (0, 3, 0.62, 0) : m == "wobbly" ? (-1.5, 2, 0.32, 7) : (0, 0, 0.22, 0)
            for e in [Self.left, Self.right] {
                let circle = Path(ellipseIn: CGRect(x: e.cx - e.r, y: e.cy - e.r, width: 2 * e.r, height: 2 * e.r))
                ctx.fill(circle, with: .color(Night.amber))
                ctx.fill(Path(ellipseIn: CGRect(x: e.cx + dx - e.pr, y: e.cy + dy - e.pr, width: 2 * e.pr, height: 2 * e.pr)), with: .color(Night.pupil))
                ctx.fill(Path(ellipseIn: CGRect(x: e.hx + dx - e.hr, y: e.hy + dy - e.hr, width: 2 * e.hr, height: 2 * e.hr)), with: .color(.white))
                // the lid, clipped to the iris; `slope` lowers the OUTER corner
                let y = e.cy - e.r + 2 * e.r * frac
                let outerLeft = e.cx < 60
                let yl = y + (outerLeft ? slope : 0), yr = y + (outerLeft ? 0 : slope)
                let x0 = e.cx - e.r - 1, x1 = e.cx + e.r + 1
                var lid = Path()
                lid.move(to: CGPoint(x: x0, y: e.cy - e.r - 1)); lid.addLine(to: CGPoint(x: x1, y: e.cy - e.r - 1))
                lid.addLine(to: CGPoint(x: x1, y: yr)); lid.addLine(to: CGPoint(x: x0, y: yl)); lid.closeSubpath()
                var c = ctx
                c.clip(to: Path(ellipseIn: CGRect(x: e.cx - e.r - 0.2, y: e.cy - e.r - 0.2, width: 2 * e.r + 0.4, height: 2 * e.r + 0.4)))
                c.fill(lid, with: .color(lidColour))
            }
            if m == "sleepy" {
                ctx.draw(Text("z").font(.system(size: 10, design: .serif).italic()).foregroundColor(Night.soft.opacity(0.8)), at: CGPoint(x: 85, y: 44))
            }
        }
        .aspectRatio(Self.box.width / Self.box.height, contentMode: .fit)
        .accessibilityHidden(true)
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
        .buttonStyle(.plain)
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
    var body: some View {
        let frac = goal > 0 ? min(1, Double(done ?? 0) / Double(goal)) : 0
        ZStack {
            Circle().fill(Night.line)
            Pie(frac: frac).fill(Night.green)
            Circle().fill(Night.panel).frame(width: 44, height: 44)
            VStack(spacing: 2) {
                Text("\(done.map(String.init) ?? "–")/\(goal)").font(.system(size: 15, weight: .semibold))
                Text(words.checkIns).font(.system(size: 8, weight: .medium)).foregroundColor(Night.soft)
            }
            .foregroundColor(.white)
        }
        .frame(width: 58, height: 58)
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
    var body: some View {
        // As the artifact draws them: a white box, ticked in the system accent (blue by default).
        RoundedRectangle(cornerRadius: 3)
            .fill(on ? Color.accentColor : Color.white)
            .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(on ? Color.accentColor : Night.faint, lineWidth: 0.5))
            .overlay(
                Path { p in p.move(to: CGPoint(x: 3.5, y: 7)); p.addLine(to: CGPoint(x: 6, y: 9.5)); p.addLine(to: CGPoint(x: 10.5, y: 4)) }
                    .stroke(Color.white, style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round))
                    .opacity(on ? 1 : 0)
            )
            .frame(width: 14, height: 14)
    }
}

struct FieldWithPlaceholder: View {
    @Binding var text: String
    let placeholder: String
    var onSubmit: () -> Void
    var focus: FocusState<Bool>.Binding? = nil
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
        .buttonStyle(.plain)
        .foregroundColor(.white)
        .help(label ?? title)
        .accessibilityLabel(label ?? title)
    }
}

struct PanelView: View {
    @ObservedObject var store: PanelStore
    var actions = PanelActions()
    @FocusState private var lineFocused: Bool

    private var w: Words { store.words }

    var body: some View {
        VStack(spacing: 0) {
            header
            if let p = store.panel, store.connected {
                stamps(p)
                todayBox(p)
                todoBox(p).padding(.top, 10)
                lineRow(p).padding(.top, 10)
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
        .focusEffectDisabled()
    }

    // ── WEEK 46 · 9–15 NOV, ‹ Today · Sat 14 › ⤢, and the ring
    private var header: some View {
        let week = store.panel.map { (no: $0.week.no, range: $0.week.range) } ?? UKDay.localWeek(store.lang)
        return HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 10) {
                Text(w.week(week.no, week.range))
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .tracking(1.9)
                    .foregroundColor(Night.gold)
                if store.connected, store.panel != nil { dayNav }
            }
            Spacer(minLength: 8)
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
                HStack(spacing: 6) {
                    Text(pillWord).font(.system(size: 14, weight: .semibold))
                    Text("· " + UKDay.short(store.panel?.day ?? "", store.lang)).font(.system(size: 14)).foregroundColor(Night.soft)
                }
                .padding(.horizontal, 14)
                .frame(height: 36)
                .background(Capsule().fill(Night.pill))
                .overlay(Capsule().strokeBorder(Night.control, lineWidth: 1))
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(pillWord + ", " + UKDay.short(store.panel?.day ?? "", store.lang))
            RoundButton(label: w.nextDay, enabled: store.canMove(1), action: { store.move(1) }) {
                Icons.forward.line(2.2, size: 14).frame(width: 14, height: 14)
            }
            RoundButton(label: w.openCalendar, action: { actions.open(store.link("/study/calendar")) }) {
                Icons.expand.line(2.2, size: 14).frame(width: 14, height: 14)
            }
        }
    }

    private var pillWord: String {
        guard let p = store.panel else { return w.today }
        if p.day == p.today { return w.today }
        if p.day == UKDay.add(p.today, -1) { return w.yesterday }
        if p.day == UKDay.add(p.today, 1) { return w.tomorrow }
        return UKDay.weekdayName(p.day, store.lang)
    }

    private func stamps(_ p: MacPanel) -> some View {
        HStack(spacing: 6) {
            ForEach(Array(p.week.days.enumerated()), id: \.offset) { i, d in
                VStack(spacing: 5) {
                    Text(i < w.dayLetters.count ? w.dayLetters[i] : "")
                        .font(.system(size: 11)).foregroundColor(Night.soft)
                    DayStamp(day: d)
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

    // ── TO-DO: open ones with tick boxes, a done one struck through, + Add a to-do
    private func todoBox(_ p: MacPanel) -> some View {
        Box {
            BoxHeading(text: w.todoBox)
            if let done = store.checkInRow {
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
                .buttonStyle(.plain)
                .disabled(done)
            }
            ForEach(p.todos) { t in
                Button(action: { store.toggle(t) }) {
                    HStack(spacing: 10) {
                        Tickbox(on: t.done)
                        Text(t.title).font(.system(size: 14)).strikethrough(t.done).lineLimit(1)
                            .foregroundColor(t.done ? Night.faint : .white)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(t.done ? .isSelected : [])
            }
            if p.todos.isEmpty && !store.addingTodo && store.checkInRow == nil {
                Text(w.noTodos).font(.system(size: 13)).foregroundColor(Night.faint)
                    .padding(.horizontal, 10).padding(.vertical, 8).frame(maxWidth: .infinity, alignment: .leading)
            }
            if store.addingTodo {
                HStack(spacing: 10) {
                    Tickbox(on: false)
                    FieldWithPlaceholder(text: $store.newTodo, placeholder: w.addTodoPlaceholder, onSubmit: store.addTodo)
                }
                .padding(.horizontal, 10).padding(.vertical, 8)
            } else {
                Button(action: { store.addingTodo = true }) {
                    Text(w.addTodo).font(.system(size: 13, weight: .semibold)).foregroundColor(Night.mint)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    // ── Tonight's line: ONE row. Heddy's eyes (tap = her mood) + the line + "+2". No lens, no heading.
    private func lineRow(_ p: MacPanel) -> some View {
        let written = p.line.state == "written"
        let forToday = store.lineIsForToday
        return HStack(spacing: 8) {
            Button(action: store.cycleMood) {
                HeddyEyes(mood: store.mood)
                    .frame(width: 30, height: 18)
                    .frame(width: 44, height: 40)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Night.field))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Night.control, lineWidth: 1))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
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
                .buttonStyle(.plain)
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
    private var shortcuts: some View {
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
            Button(action: actions.gear) {
                Icons.gear.line(1.8, size: 18).frame(width: 18, height: 18)
                    .frame(width: 44, height: 44).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundColor(Night.soft)
            .help(w.settings)
            .accessibilityLabel(w.settings)
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
class AppDelegate: NSObject, NSApplicationDelegate, ASWebAuthenticationPresentationContextProviding {

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
