# Changelog

[compare changes](https://github.com/duhnunes/scs-intellisense/compare/v0.2.0...0.3.0)
### Features

* **parser:** add ValidationError with precise diagnostics for class header parsing ([aeb2336](https://github.com/duhnunes/scs-intellisense/commit/aeb233681175279d5c3e4d93d402a251b712afea))

### Bug Fixes

* **parser:** enforce colon between className nd unitName ([bd90e1b](https://github.com/duhnunes/scs-intellisense/commit/bd90e1b1660a189b1b11f053c112169c08114206))

## [0.2.0](https://github.com/duhnunes/scs-intellisense/compare/0.1.1...v0.2.0) (2026-06-07)

### Features

* **client:** add .sii/.sui and refresh docs/assets ([ba23299](https://github.com/duhnunes/scs-intellisense/commit/ba2329945a168f5365e2509c7e4e24d3a61b71d1))

### Bug Fixes

* **parser:** ignore block comments inside class bodies when parsing attributes ([d4ad1fd](https://github.com/duhnunes/scs-intellisense/commit/d4ad1fdd4c47595ccfcacefc8579003ae423da91))
* **semantic:** emit token segments for owner_ptr/linkptr without coloring dots ([4ffd933](https://github.com/duhnunes/scs-intellisense/commit/4ffd933492a43bb342dd14aec3d6923451996a06))
* **semantic:** support IEEE-hex floats and tokenize numeric tuples correctly ([9c14a96](https://github.com/duhnunes/scs-intellisense/commit/9c14a9622cf757c8b9bb9c144b279ea5f81ecd7e))
* **semantic:** tokenize numeric tuples and placement groups correctly ([8c26dc5](https://github.com/duhnunes/scs-intellisense/commit/8c26dc5484f89ad72f52afec81c0d537915b6212))

## 0.1.1 (2026-06-05)

### Bug Fixes

* **parser:** remove redundant initial assignment for valueEnd in attribute parser ([de0e143](https://github.com/duhnunes/scs-intellisense/commit/de0e14340e9e2b2bd618ef94d8c0c02645b3a66b))
* **semantic-highlighting:** correct block comment detectionn for /* ... */ ([c22959d](https://github.com/duhnunes/scs-intellisense/commit/c22959d34b0a5ab95dfced5599e940d68aad478c))
* **semantic-highlighting:** include array brackets in keyRange and prefer comment tokens ([1a7c2d3](https://github.com/duhnunes/scs-intellisense/commit/1a7c2d360d6145aea1726043148f2a9610166355))

## 0.1.0 (2026-06-04)

### Features

* **command:** Add commandpallet to show Output channel and to Clear Output channel messages ([5c592b7](https://github.com/duhnunes/scs-intellisense/commit/5c592b74dad98d957204479fa9a1c75337a1a5b8))
* **completion:** add global [@include](https://github.com/include) directive and semantic highlighting ([ef9dd23](https://github.com/duhnunes/scs-intellisense/commit/ef9dd23aa40bb6d48dd15cf93a2f0047ef813dab))
* **config:** sync semanticHighlighting with extension menu ([139f15c](https://github.com/duhnunes/scs-intellisense/commit/139f15cfbb223af9a319d4a9dfd6ab4d9c153f3e))
* **content:** add more content in database ([c35ac5f](https://github.com/duhnunes/scs-intellisense/commit/c35ac5fb8384ecfc4493095c51410524f42edcb5))
* **db:** add content to database ([de69160](https://github.com/duhnunes/scs-intellisense/commit/de69160697521e39fa1828c9bd5344c8afbc81f1))
* **db:** add database for completion system. ([374f7e9](https://github.com/duhnunes/scs-intellisense/commit/374f7e91d6a566c63a4f662873a5515894e431ac))

### Bug Fixes

* adjust serverModule path and add compile script ([72b1ad1](https://github.com/duhnunes/scs-intellisense/commit/72b1ad131b2837f70cb06d60bff5643e33ba468c))
* **comments:** Fix hightlightin comments ([e0ea762](https://github.com/duhnunes/scs-intellisense/commit/e0ea762d5fc5ded40a38d27e7cf0ead054622327))
* **completion:** don't show completion suggestions when cursor is inside comments ([25587b5](https://github.com/duhnunes/scs-intellisense/commit/25587b597cd4edf3d6456d7d76c33345a0bce663))
* **completion:** handle undefined attr.type and silence unused param ([7d6f594](https://github.com/duhnunes/scs-intellisense/commit/7d6f5945e800fc1328edc8b4fa0ceb38088dfe42))
* **refactor:** add pnpm-lock.yaml to last commit. ([8ff151c](https://github.com/duhnunes/scs-intellisense/commit/8ff151c46fac56ee6f81b4d76d2e893acf6738c5))
* **semantic/completion:** restore semantic highlighting and accept keys without space after colon ([cb3fc92](https://github.com/duhnunes/scs-intellisense/commit/cb3fc92a9578e6d73a893c24b5c58266b1e65867))
* **semantic:** ignore comment markers inside strings when tokenizing comments ([72419f3](https://github.com/duhnunes/scs-intellisense/commit/72419f31812d90aa1df671f1c5a87973b744f9e8))
* **semantic:** include quotes in [@include](https://github.com/include) string token ([6fec91a](https://github.com/duhnunes/scs-intellisense/commit/6fec91a08b5ab8ea168b9faa81d11ccf05b070e4))
* **semantic:** infer value types for accurate highlighting in .sii/.sui ([c44acee](https://github.com/duhnunes/scs-intellisense/commit/c44aceef2b7f523c07453dfff58ddcdf1deaf029))
* **semantic:** preserve value highlighting when followed by inline comments ([60ea53e](https://github.com/duhnunes/scs-intellisense/commit/60ea53e9575ecd9bd205bfba18c30e6c5df60804))
* **types:** fix type and delete files related to completion system ([30db31c](https://github.com/duhnunes/scs-intellisense/commit/30db31cf7d8bc23176059b44beee36e3ddeea55c))
* **workflow:** try fix problem with github actions ([6153b25](https://github.com/duhnunes/scs-intellisense/commit/6153b2562c92247a28d66a07bc7e6b2caf905eac))

### Refactors

* **completion:** move parser helpers to folder. ([d717a22](https://github.com/duhnunes/scs-intellisense/commit/d717a220a7db82ba97182cd177dd81321e06e52f))
* **parser:** extract class and attribute parsing into server/src/parser ([5cd6a0b](https://github.com/duhnunes/scs-intellisense/commit/5cd6a0b77203cd4654554d1b3e49606484174c9f))
* **parser:** move parserDocument to file with some logic to detect file extension. ([33293bf](https://github.com/duhnunes/scs-intellisense/commit/33293bfe43d7160e821f89c6ec0818b101fea946))
* **release:** rename automation script: ([0be5522](https://github.com/duhnunes/scs-intellisense/commit/0be5522e170c781967ab9fc2858b00c2981d0507))
* **server:** reorganize src layout and fix semantic types ([98070d3](https://github.com/duhnunes/scs-intellisense/commit/98070d3ee50e273a667aae25622253f6c448bb72))
* **world-defs:** rename files to class_name and add explicit undefined types ([211baae](https://github.com/duhnunes/scs-intellisense/commit/211baaeff90376c9480dd2be1d4939570b3a8cc4))

## [0.1.1](https://github.com/duhnunes/scs-intellisense/compare/0.1.0...0.1.1) (2026-06-05)

### Bug Fixes

* **parser:** remove redundant initial assignment for valueEnd in attribute parser ([de0e143](https://github.com/duhnunes/scs-intellisense/commit/de0e14340e9e2b2bd618ef94d8c0c02645b3a66b))
* **semantic-highlighting:** correct block comment detectionn for /* ... */ ([c22959d](https://github.com/duhnunes/scs-intellisense/commit/c22959d34b0a5ab95dfced5599e940d68aad478c))
* **semantic-highlighting:** include array brackets in keyRange and prefer comment tokens ([1a7c2d3](https://github.com/duhnunes/scs-intellisense/commit/1a7c2d360d6145aea1726043148f2a9610166355))

## 0.1.0 (2026-06-04)

### Features

* **command:** Add commandpallet to show Output channel and to Clear Output channel messages ([5c592b7](https://github.com/duhnunes/scs-intellisense/commit/5c592b74dad98d957204479fa9a1c75337a1a5b8))
* **completion:** add global [@include](https://github.com/include) directive and semantic highlighting ([ef9dd23](https://github.com/duhnunes/scs-intellisense/commit/ef9dd23aa40bb6d48dd15cf93a2f0047ef813dab))
* **config:** sync semanticHighlighting with extension menu ([139f15c](https://github.com/duhnunes/scs-intellisense/commit/139f15cfbb223af9a319d4a9dfd6ab4d9c153f3e))
* **content:** add more content in database ([c35ac5f](https://github.com/duhnunes/scs-intellisense/commit/c35ac5fb8384ecfc4493095c51410524f42edcb5))
* **db:** add content to database ([de69160](https://github.com/duhnunes/scs-intellisense/commit/de69160697521e39fa1828c9bd5344c8afbc81f1))
* **db:** add database for completion system. ([374f7e9](https://github.com/duhnunes/scs-intellisense/commit/374f7e91d6a566c63a4f662873a5515894e431ac))

### Bug Fixes

* adjust serverModule path and add compile script ([72b1ad1](https://github.com/duhnunes/scs-intellisense/commit/72b1ad131b2837f70cb06d60bff5643e33ba468c))
* **comments:** Fix hightlightin comments ([e0ea762](https://github.com/duhnunes/scs-intellisense/commit/e0ea762d5fc5ded40a38d27e7cf0ead054622327))
* **completion:** don't show completion suggestions when cursor is inside comments ([25587b5](https://github.com/duhnunes/scs-intellisense/commit/25587b597cd4edf3d6456d7d76c33345a0bce663))
* **completion:** handle undefined attr.type and silence unused param ([7d6f594](https://github.com/duhnunes/scs-intellisense/commit/7d6f5945e800fc1328edc8b4fa0ceb38088dfe42))
* **refactor:** add pnpm-lock.yaml to last commit. ([8ff151c](https://github.com/duhnunes/scs-intellisense/commit/8ff151c46fac56ee6f81b4d76d2e893acf6738c5))
* **semantic/completion:** restore semantic highlighting and accept keys without space after colon ([cb3fc92](https://github.com/duhnunes/scs-intellisense/commit/cb3fc92a9578e6d73a893c24b5c58266b1e65867))
* **semantic:** ignore comment markers inside strings when tokenizing comments ([72419f3](https://github.com/duhnunes/scs-intellisense/commit/72419f31812d90aa1df671f1c5a87973b744f9e8))
* **semantic:** include quotes in [@include](https://github.com/include) string token ([6fec91a](https://github.com/duhnunes/scs-intellisense/commit/6fec91a08b5ab8ea168b9faa81d11ccf05b070e4))
* **semantic:** infer value types for accurate highlighting in .sii/.sui ([c44acee](https://github.com/duhnunes/scs-intellisense/commit/c44aceef2b7f523c07453dfff58ddcdf1deaf029))
* **semantic:** preserve value highlighting when followed by inline comments ([60ea53e](https://github.com/duhnunes/scs-intellisense/commit/60ea53e9575ecd9bd205bfba18c30e6c5df60804))
* **types:** fix type and delete files related to completion system ([30db31c](https://github.com/duhnunes/scs-intellisense/commit/30db31cf7d8bc23176059b44beee36e3ddeea55c))
* **workflow:** try fix problem with github actions ([6153b25](https://github.com/duhnunes/scs-intellisense/commit/6153b2562c92247a28d66a07bc7e6b2caf905eac))

### Refactors

* **completion:** move parser helpers to folder. ([d717a22](https://github.com/duhnunes/scs-intellisense/commit/d717a220a7db82ba97182cd177dd81321e06e52f))
* **parser:** extract class and attribute parsing into server/src/parser ([5cd6a0b](https://github.com/duhnunes/scs-intellisense/commit/5cd6a0b77203cd4654554d1b3e49606484174c9f))
* **parser:** move parserDocument to file with some logic to detect file extension. ([33293bf](https://github.com/duhnunes/scs-intellisense/commit/33293bfe43d7160e821f89c6ec0818b101fea946))
* **release:** rename automation script: ([0be5522](https://github.com/duhnunes/scs-intellisense/commit/0be5522e170c781967ab9fc2858b00c2981d0507))
* **server:** reorganize src layout and fix semantic types ([98070d3](https://github.com/duhnunes/scs-intellisense/commit/98070d3ee50e273a667aae25622253f6c448bb72))
* **world-defs:** rename files to class_name and add explicit undefined types ([211baae](https://github.com/duhnunes/scs-intellisense/commit/211baaeff90376c9480dd2be1d4939570b3a8cc4))
