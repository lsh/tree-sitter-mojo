import XCTest
import SwiftTreeSitter
import TreeSitterMojo

final class TreeSitterMojoTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_mojo())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Mojo grammar")
    }
}
