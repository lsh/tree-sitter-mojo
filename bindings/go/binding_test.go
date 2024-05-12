package tree_sitter_mojo_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_mojo "github.com/tree-sitter/tree-sitter-mojo/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_mojo.Language())
	if language == nil {
		t.Errorf("Error loading Mojo grammar")
	}
}
