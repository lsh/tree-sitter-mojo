# tree-sitter-mojo

Mojo grammar for [tree-sitter][].

Originally forked from [tree-sitter-python][] (by Max Brunsfeld and
contributors), with the Mojo-specific grammar authored and maintained by
[Lukas Hermann][] for current Mojo (unified closures, capture lists,
t-strings, contextual member refs, and more — see the [feature notes][]).

[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[tree-sitter-python]: https://github.com/tree-sitter/tree-sitter-python
[Lukas Hermann]: https://github.com/lsh
[feature notes]: docs/features.md

## References

- [Mojo manual](https://docs.modular.com/mojo/manual/)
- [tree-sitter-python](https://github.com/tree-sitter/tree-sitter-python)

## License

MIT (see [LICENSE](LICENSE)), except `queries/locals.scm`,
`queries/textobjects.scm` and `queries/injections.scm`, which are adapted
from [Helix](https://github.com/helix-editor/helix)'s Python queries and are
licensed under the [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/),
as noted in each file's header.
