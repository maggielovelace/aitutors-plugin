// Stands in for the converter's Shared (App)/ViewController.swift, so safari-mac/AppDelegate.swift compiles alone.
import Cocoa
import WebKit
let extensionBundleIdentifier = "me.aitutors.heddy.safari.Extension"
class ViewController: NSViewController { @IBOutlet var webView: WKWebView! }
