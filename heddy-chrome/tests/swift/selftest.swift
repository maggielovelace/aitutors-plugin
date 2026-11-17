// Behaviour checks for safari-mac/AppDelegate.swift, compiled and run by tests/safari-mac-swift.test.mjs.
// No network: every request goes to Stub. No visible window: the text-field check uses an off-screen window.
import Cocoa
import SwiftUI

final class Stub: URLProtocol {
    static var status = 200
    static var body = Data()
    static var last: (method: String, url: String, headers: [String: String], body: Data)?
    /// Every POST body, in order (a write is followed by its refresh GET, which replaces `last`).
    static var posts: [Data] = []
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        var data = request.httpBody ?? Data()
        if data.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            var buf = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable { let n = stream.read(&buf, maxLength: buf.count); if n <= 0 { break }; data.append(buf, count: n) }
            stream.close()
        }
        Stub.last = (request.httpMethod ?? "", request.url?.absoluteString ?? "", request.allHTTPHeaderFields ?? [:], data)
        if request.httpMethod == "POST" { Stub.posts.append(data) }
        let res = HTTPURLResponse(url: request.url!, statusCode: Stub.status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: res, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Stub.body)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

var failures = 0
func check(_ ok: Bool, _ name: String) {
    if !ok { failures += 1; print("FAIL \(name)") } else { print("ok   \(name)") }
}
func respond(_ status: Int, _ json: String) { Stub.status = status; Stub.body = Data(json.utf8) }
func spin(_ s: Double = 0.15) { RunLoop.main.run(until: Date().addingTimeInterval(s)) }

let todosJSON = (1...6).map { #"{"id":"0000000\#($0)-0000-4000-8000-000000000000","title":"Todo \#($0)","priority":"none","done":false}"# }.joined(separator: ",")
func panelJSON(today: String, day: String, todos: String = todosJSON, checkedToday: Bool = false) -> String {
    #"{"v":1,"builtAt":"2026-11-15T09:00:00.000Z","today":"\#(today)","day":"\#(day)","lang":"en","week":{"no":46,"range":"9–15 Nov","days":[{"day":"\#(today)","isToday":true,"checkedIn":\#(checkedToday),"test":false}],"checkIns":7,"goal":5},"items":[],"nextTest":null,"todos":[\#(todos)],"openTodos":17,"cardsDue":49,"line":{"state":"open","mood":null}}"#
}
func panel(_ json: String) -> MacPanel { try! JSONDecoder().decode(MacPanel.self, from: Data(json.utf8)) }

@main
struct SelfTest {
    @MainActor static func main() async {
        NSApplication.shared.setActivationPolicy(.prohibited)
        let cfg = URLSessionConfiguration.ephemeral
        cfg.protocolClasses = [Stub.self]
        var api = HeddyAPI()
        api.session = URLSession(configuration: cfg)

        // ── the add request, exactly as app/api/heddy/mac/todo/route.ts reads it
        respond(200, #"{"type":"ok","item":{"id":"aaaaaaaa-0000-4000-8000-000000000000","title":"Pack bag","startsOn":null,"noDay":true}}"#)
        let r200 = await api.write("/api/heddy/mac/todo", token: "tok", body: ["op": "add", "title": "Pack bag"])
        if case .ok = r200 { check(true, "200 {type:ok,item} is a success") } else { check(false, "200 {type:ok,item} is a success") }
        let last = Stub.last
        check(last?.method == "POST", "POST")
        check(last?.url == "https://aitutors.me/api/heddy/mac/todo", "to https://aitutors.me/api/heddy/mac/todo")
        check(last?.headers["Authorization"] == "Bearer tok", "Bearer token")
        check(last?.headers["Content-Type"] == "application/json", "JSON content type")
        let sent = (try? JSONSerialization.jsonObject(with: last?.body ?? Data())) as? [String: String]
        check(sent == ["op": "add", "title": "Pack bag"], "body is exactly {op:add,title}")
        respond(201, #"{"type":"ok","item":{"id":"b","title":"x"}}"#)
        if case .ok = await api.write("/api/heddy/mac/todo", token: "tok", body: [:]) { check(true, "201 relay decodes as a success") } else { check(false, "201 relay decodes as a success") }
        respond(400, #"{"type":"bad-request","reason":"title"}"#)
        if case .failed(let why) = await api.write("/api/heddy/mac/todo", token: "tok", body: [:]) {
            check(why.contains("400") && why.contains("title"), "400 fails with the reason for the log")
        } else { check(false, "400 fails") }
        respond(200, #"{"type":"bad-request"}"#)
        if case .failed = await api.write("/api/heddy/mac/todo", token: "tok", body: [:]) { check(true, "a 2xx without type:ok is not a success") } else { check(false, "a 2xx without type:ok is not a success") }
        respond(503, #"{"type":"write-failed"}"#)
        if case .failed = await api.write("/api/heddy/mac/todo", token: "tok", body: [:]) { check(true, "503 fails") } else { check(false, "503 fails") }
        respond(401, #"{"type":"unauthenticated"}"#)
        if case .signedOut = await api.write("/api/heddy/mac/todo", token: "tok", body: [:]) { check(true, "401 signs out") } else { check(false, "401 signs out") }
        respond(200, #"{"type":"safeguarding","message":"Childline","saved":true}"#)
        if case .safeguarding(let m) = await api.write("/api/heddy/mac/todo", token: "tok", body: [:]) { check(m == "Childline", "safeguarding message passes through") } else { check(false, "safeguarding") }

        // ── the store's add flow: failure keeps the text and says so; success closes and says Added
        let store = PanelStore(fixture: panel(panelJSON(today: "2026-11-15", day: "2026-11-15")))
        store.api = api
        store.addingTodo = true
        store.newTodo = "Pack bag"
        respond(400, #"{"type":"bad-request","reason":"title"}"#)
        await store.addTodo()?.value
        check(store.addingTodo && store.newTodo == "Pack bag", "a failed add keeps the box and the text")
        check(store.addError == store.words.addFailed, "a failed add says so")
        respond(200, #"{"type":"ok","item":{"id":"c","title":"Pack bag"}}"#)
        await store.addTodo()?.value
        check(!store.addingTodo && store.newTodo.isEmpty && store.addError == nil, "a successful add closes and clears")
        check(store.addedNote, "a successful add says Added")
        // cancel paths
        store.addingTodo = true; store.newTodo = "half typed"
        store.blurAdd()
        check(store.addingTodo && store.newTodo == "half typed", "clicking away keeps typed text")
        store.cancelAdd()
        check(!store.addingTodo && store.newTodo.isEmpty, "Esc / ✕ cancels")
        store.addingTodo = true; store.newTodo = "  "
        store.blurAdd()
        check(!store.addingTodo, "clicking away from an empty box closes it")
        store.addingTodo = true; store.newTodo = ""
        check(store.addTodo() == nil && !store.addingTodo, "Return on an empty box closes it, sends nothing")

        // ── Return and Esc reach the handlers in a real text field (off screen)
        final class Box { var text = ""; var submitted = 0; var exited = 0 }
        let box = Box()
        let field = FieldWithPlaceholder(text: Binding(get: { box.text }, set: { box.text = $0 }), placeholder: "New to-do",
                                         onSubmit: { box.submitted += 1 }, onExit: { box.exited += 1 })
        let host = NSHostingView(rootView: field.frame(width: 240, height: 30))
        let win = NSWindow(contentRect: NSRect(x: -10000, y: -10000, width: 260, height: 40), styleMask: [.borderless], backing: .buffered, defer: false)
        win.contentView = host
        host.layoutSubtreeIfNeeded(); spin()
        func find(_ v: NSView) -> NSTextField? { if let t = v as? NSTextField, t.isEditable { return t }; for s in v.subviews { if let t = find(s) { return t } }; return nil }
        if let tf = find(host) {
            win.makeFirstResponder(tf); spin()
            let editor = tf.currentEditor() as? NSTextView
            editor?.insertText("Pack bag", replacementRange: NSRange(location: NSNotFound, length: 0)); spin()
            editor?.insertNewline(nil); spin()
            check(box.submitted == 1 && box.text == "Pack bag", "Return in the field submits (got \(box.submitted), '\(box.text)')")
            win.makeFirstResponder(tf); spin()
            (tf.currentEditor() as? NSTextView)?.doCommand(by: #selector(NSResponder.cancelOperation(_:))); spin()
            check(box.exited == 1, "Esc in the field cancels (got \(box.exited))")
        } else { check(false, "found the text field") }

        // ── the to-do box (M15, design B): five rows, Doing first, a status pill on each
        func todo(_ n: Int, _ status: String?) -> String {
            let st = status.map { #","status":"\#($0)""# } ?? ""
            return #"{"id":"0000000\#(n)-0000-4000-8000-000000000000","title":"Todo \#(n)","priority":"none","done":false\#(st)}"#
        }
        let legacy = panel(panelJSON(today: "2026-11-15", day: "2026-11-15"))
        check(legacy.todos.allSatisfy { $0.status == nil && $0.state == "todo" } && legacy.doneToday == nil, "a feed from before M15 still decodes (state from done)")
        var legacyDone = legacy.todos[0]; legacyDone.done = true
        check(legacyDone.state == "done", "a legacy done row reads as done")
        let mixedJSON = [todo(1, "todo"), todo(2, "todo"), todo(3, "doing"), todo(4, "todo"), todo(5, "doing"), todo(6, "todo")].joined(separator: ",")
        let mixedTodos = panel(panelJSON(today: "2026-11-15", day: "2026-11-15", todos: mixedJSON)).todos
        let ids = { (rows: [TodoRow]) in rows.map { $0.id.hasPrefix("0000000") ? String($0.id.dropFirst(7).prefix(1)) : $0.id } }
        check(ids(TodoList.rows(checkIn: false, todos: mixedTodos)) == ["3", "5", "checkin", "1", "2"], "Doing first, the check-in heads To do, five at most (got \(ids(TodoList.rows(checkIn: false, todos: mixedTodos))))")
        check(ids(TodoList.rows(checkIn: nil, todos: mixedTodos)) == ["3", "5", "1", "2", "4"], "no check-in row: five board rows")
        check(ids(TodoList.rows(checkIn: true, todos: mixedTodos)).count == 5 && !ids(TodoList.rows(checkIn: true, todos: mixedTodos)).contains("checkin"), "a checked-in day: the row leaves")
        var withDone = mixedTodos; withDone[2].status = "done"; withDone[2].done = true
        check(!ids(TodoList.rows(checkIn: nil, todos: withDone)).contains("3"), "a done row leaves the list")
        check(TodoList.rows(checkIn: false, todos: Array(mixedTodos.prefix(2))).count == 3, "fewer than five: all of them")
        check(TodoList.next("todo") == "doing" && TodoList.next("doing") == "done" && TodoList.next("done") == "todo", "the pill cycles To do → Doing → Done → To do")
        for (w, words) in [(Words(lang: .en), ["To do", "Doing", "Done"]), (Words(lang: .zh), ["待做", "进行中", "已完成"])] {
            check(["todo", "doing", "done"].map(w.status) == words, "\(w.lang) statuses are the catalog's words")
        }
        let wen = Words(lang: .en), wzh = Words(lang: .zh)
        check(wen.todoCounts(12, 3) == "12 open · 3 done" && wen.allInCalendar(12) == "All 12 in My calendar ↗", "en header and footer")
        check(wzh.todoCounts(12, 3) == "12 未完成 · 3 已完成" && wzh.allInCalendar(12) == "在我的日历看全部 12 项 ↗", "zh header and footer")

        // the pill and the box write through /api/heddy/mac/todo, at once, and roll back on a refusal
        let pills = PanelStore(fixture: panel(panelJSON(today: "2026-11-15", day: "2026-11-15", todos: mixedJSON)))
        pills.api = api
        let first = pills.panel!.todos[0]
        respond(503, #"{"type":"write-failed"}"#)
        let failing = pills.cycle(first)
        check(pills.panel?.todos[0].state == "doing", "the pill shows Doing at once")
        await failing?.value
        check(pills.panel?.todos[0].state == "todo" && pills.notice == pills.words.writeFailed, "a refused Doing rolls back and says so")
        respond(200, #"{"type":"ok"}"#)
        await pills.cycle(first)?.value
        let sentStatus = Stub.posts.last.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: String] }
        check(sentStatus == ["op": "status", "id": first.id, "status": "doing"], "the pill sends status doing (got \(String(describing: sentStatus)))")
        check(pills.panel?.todos[0].state == "doing" && pills.panel?.openTodos == 17, "Doing stays open: the owl keeps its count")
        let nowDoing = pills.panel!.todos[0]
        await pills.cycle(nowDoing)?.value
        check(pills.panel?.todos[0].state == "done" && pills.panel?.openTodos == 16 && pills.panel?.doneToday == 1, "Done: one fewer open, one more done")
        check(!pills.todoRows.contains { $0.id == first.id }, "and it leaves the list")
        let tick = pills.panel!.todos[1]
        respond(500, "{}")
        await pills.toggle(tick)?.value
        check(pills.panel?.todos[1].state == "todo" && pills.panel?.openTodos == 16 && pills.panel?.doneToday == 1, "a failed tick rolls back the counts too")

        // ── the pill: one weekday, never two
        let en = Words(lang: .en), zh = Words(lang: .zh)
        for (day, w, word, rest) in [("2026-11-15", en, "Today", "Sun 15"), ("2026-11-14", en, "Yesterday", "Sat 14"),
                                     ("2026-11-16", en, "Tomorrow", "Mon 16"), ("2026-11-18", en, "Wed", "18 Nov"),
                                     ("2026-11-15", zh, "今天", "周日 15"), ("2026-11-14", zh, "昨天", "周六 14"),
                                     ("2026-11-16", zh, "明天", "周一 16"), ("2026-11-18", zh, "周三", "11月18日")] {
            let p = UKDay.pill(day, today: "2026-11-15", w)
            check(p.word == word && p.rest == rest, "pill \(day) \(w.lang): \(p.word) · \(p.rest)")
        }

        // ── the ring: over the goal stays full; the text box fits inside the inner circle
        check(CheckRing.fraction(7, 5) == 1 && CheckRing.fraction(3, 5) == 0.6 && CheckRing.fraction(nil, 5) == 0, "ring fraction, capped at full")
        let corner = (pow(CheckRing.textWidth / 2, 2) + pow(CheckRing.textHeight / 2, 2)).squareRoot()
        check(corner <= CheckRing.inner / 2 - 1, "the text box's corners sit inside the inner circle (\(corner) vs \(CheckRing.inner / 2))")

        // ── the eyes: the site's keyframes, never clipped, still when they should be
        check(abs(HeddyMotion.blink(phase: 0.34) - 0.1) < 0.001 && HeddyMotion.blink(phase: 0.5) == 1 && abs(HeddyMotion.blink(phase: 0.8) - 0.74) < 0.001, "heddy-blink keyframes")
        let g = HeddyMotion.gaze(phase: 0.26)
        check(abs(g.x - 3.2) < 0.001 && abs(g.y + 1) < 0.001 && HeddyMotion.gaze(phase: 0.9) == .zero, "heddy-gaze keyframes")
        let still = HeddyMotion.pose(at: Date(), animating: false, lookUp: false, blinkAt: nil)
        check(still.blink == 1 && still.gaze == .zero, "not animating: no blink, no gaze")
        let tap = Date(timeIntervalSinceReferenceDate: 1000.0 * HeddyMotion.blinkPeriod + 0.5 * HeddyMotion.blinkPeriod)
        check(HeddyMotion.pose(at: tap.addingTimeInterval(HeddyMotion.tapBlink / 2), animating: true, lookUp: false, blinkAt: tap).blink < 0.15, "a tap blinks")
        check(HeddyMotion.pose(at: Date(), animating: true, lookUp: true, blinkAt: nil).gaze == HeddyMotion.lookUp, "hover: she looks up")
        check(HeddyEyes.box.insetBy(dx: 1, dy: 1).contains(CGRect(x: 32.5, y: 43.5, width: 52.5, height: 27)), "both irises inside the drawing box")
        check(HeddyMotion.gazeReach * 13.5 + 6.7 <= 13.5 && HeddyMotion.gazeReach * 11 + 5.6 <= 11, "the gaze never takes a pupil out of its iris")
        for m in ["calm", "sleepy", "wobbly"] {
            let l = HeddyEyes.lid(m)
            check(max(l.inner, l.outer) <= 0.5, "\(m): the lid leaves at least half of the eye")
        }
        check(HeddyEyes.lid("calm").inner <= 0.2, "calm shows the eye whole (a sliver of lid)")
        let eyes = PanelStore(fixture: panel(panelJSON(today: "2026-11-15", day: "2026-11-15")))
        eyes.panelVisible = false; eyes.reduceMotion = false
        check(!eyes.eyesAnimating, "closed popover: no animation")
        eyes.panelVisible = true
        check(eyes.eyesAnimating, "open popover: animation")
        eyes.reduceMotion = true
        check(!eyes.eyesAnimating, "Reduce Motion: no animation")

        // ── Mentor's composer: today before 21:00; Tonight's line from 21:00 and on other days
        var london = Calendar(identifier: .gregorian)
        london.timeZone = TimeZone(identifier: "Europe/London")!
        func at(_ h: Int, _ m: Int, day: Int = 16) -> Date { london.date(from: DateComponents(year: 2026, month: 11, day: day, hour: h, minute: m))! }
        check(MentorComposer.lineOpensHour == 21, "the line opens at 21:00")
        check(!MentorComposer.showsLine(isToday: true, now: at(20, 59), calendar: london), "today 20:59: Mentor's composer")
        check(!MentorComposer.showsLine(isToday: true, now: at(18, 0), calendar: london), "today 18:00: still Mentor (not the old 18:00)")
        check(MentorComposer.showsLine(isToday: true, now: at(21, 0), calendar: london), "today 21:00: Tonight's line")
        check(!MentorComposer.showsLine(isToday: true, now: at(0, 5), calendar: london), "today just after midnight: Mentor")
        check(MentorComposer.showsLine(isToday: false, now: at(9, 0), calendar: london), "another day at 09:00: Tonight's line as before")
        check(MentorComposer.nextFlip(after: at(9, 30), calendar: london) == at(21, 0), "before 21:00 the row next flips at 21:00")
        check(MentorComposer.nextFlip(after: at(21, 0), calendar: london) == at(0, 0, day: 17), "from 21:00 it next flips at midnight")
        check(MentorComposer.flips(after: at(9, 30), calendar: london) == [at(21, 0), at(0, 0, day: 17)], "an open panel wakes at 21:00 and again at midnight")
        let base = URL(string: "https://aitutors.me/study/calendar")!
        check(MentorComposer.askURL("   ", day: "2026-11-16", base: base) == nil, "empty: no link (Enter does nothing)")
        let ask = MentorComposer.askURL(" Football 1+1 at 10 & bring boots? ", day: "2026-11-16", base: base)!
        let q = ask.absoluteString
        check(q.hasPrefix("https://aitutors.me/study/calendar?day=2026-11-16&ask="), "the calendar, on today: \(q)")
        check(q.contains("%2B") && q.contains("%26") && !q.contains("+"), "+ and & are encoded for URLSearchParams")
        // decode the way the page does (application/x-www-form-urlencoded: + is a space, then percent-decoding)
        let raw = q.components(separatedBy: "ask=")[1]
        let decoded = raw.replacingOccurrences(of: "+", with: " ").removingPercentEncoding
        check(decoded == "Football 1+1 at 10 & bring boots?", "the page reads back exactly her words (got \(decoded ?? "nil"))")
        let zhURL = MentorComposer.askURL("明天下午三点踢足球", day: "2026-11-16", base: URL(string: "https://aitutors.me/zh/study/calendar")!)!
        check(zhURL.path == "/zh/study/calendar" && zhURL.absoluteString.components(separatedBy: "ask=")[1].removingPercentEncoding == "明天下午三点踢足球", "zh: /zh path, words intact")
        let long = MentorComposer.askURL(String(repeating: "x", count: 900), day: "2026-11-16", base: base)!
        check(long.absoluteString.components(separatedBy: "ask=")[1].count == MentorComposer.askMax, "capped at 500, like the page")

        print(failures == 0 ? "SELFTEST OK" : "SELFTEST FAILED \(failures)")
        exit(failures == 0 ? 0 : 1)
    }
}
