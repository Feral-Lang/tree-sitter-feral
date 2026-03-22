import XCTest
import SwiftTreeSitter
import TreeSitterFeral

final class TreeSitterFeralTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_feral())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Feral grammar")
    }
}
