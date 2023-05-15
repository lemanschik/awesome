/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { testTokenization } from '../test/testRunner';

testTokenization('cpp', [
	// Keywords
	[
		{
			line: 'int _tmain(int argc, _TCHAR* argv[])',
			tokens: [
				{ startIndex: 0, type: 'keyword.int.cpp' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'identifier.cpp' },
				{ startIndex: 10, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 11, type: 'keyword.int.cpp' },
				{ startIndex: 14, type: '' },
				{ startIndex: 15, type: 'identifier.cpp' },
				{ startIndex: 19, type: 'delimiter.cpp' },
				{ startIndex: 20, type: '' },
				{ startIndex: 21, type: 'identifier.cpp' },
				{ startIndex: 27, type: 'delimiter.cpp' },
				{ startIndex: 28, type: '' },
				{ startIndex: 29, type: 'identifier.cpp' },
				{ startIndex: 33, type: 'delimiter.square.cpp' },
				{ startIndex: 35, type: 'delimiter.parenthesis.cpp' }
			]
		}
	],

	// Comments - single line
	[
		{
			line: '//',
			tokens: [{ startIndex: 0, type: 'comment.cpp' }]
		}
	],

	[
		{
			line: '    // a comment',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 4, type: 'comment.cpp' }
			]
		}
	],

	[
		{
			line: '// a comment',
			tokens: [{ startIndex: 0, type: 'comment.cpp' }]
		}
	],

	[
		{
			line: '//sticky comment',
			tokens: [{ startIndex: 0, type: 'comment.cpp' }]
		}
	],

	[
		{
			line: '/almost a comment',
			tokens: [
				{ startIndex: 0, type: 'delimiter.cpp' },
				{ startIndex: 1, type: 'identifier.cpp' },
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'identifier.cpp' },
				{ startIndex: 9, type: '' },
				{ startIndex: 10, type: 'identifier.cpp' }
			]
		}
	],

	[
		{
			line: '/* //*/ a',
			tokens: [
				{ startIndex: 0, type: 'comment.cpp' },
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'identifier.cpp' }
			]
		}
	],

	[
		{
			line: '1 / 2; /* comment',
			tokens: [
				{ startIndex: 0, type: 'number.cpp' },
				{ startIndex: 1, type: '' },
				{ startIndex: 2, type: 'delimiter.cpp' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'number.cpp' },
				{ startIndex: 5, type: 'delimiter.cpp' },
				{ startIndex: 6, type: '' },
				{ startIndex: 7, type: 'comment.cpp' }
			]
		}
	],

	[
		{
			line: 'int x = 1; // my comment // is a nice one',
			tokens: [
				{ startIndex: 0, type: 'keyword.int.cpp' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'identifier.cpp' },
				{ startIndex: 5, type: '' },
				{ startIndex: 6, type: 'delimiter.cpp' },
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'number.cpp' },
				{ startIndex: 9, type: 'delimiter.cpp' },
				{ startIndex: 10, type: '' },
				{ startIndex: 11, type: 'comment.cpp' }
			]
		}
	],

	// Comments - range comment, single line
	[
		{
			line: '/* a simple comment */',
			tokens: [{ startIndex: 0, type: 'comment.cpp' }]
		}
	],

	[
		{
			line: 'int x = /* a simple comment */ 1;',
			tokens: [
				{ startIndex: 0, type: 'keyword.int.cpp' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'identifier.cpp' },
				{ startIndex: 5, type: '' },
				{ startIndex: 6, type: 'delimiter.cpp' },
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'comment.cpp' },
				{ startIndex: 30, type: '' },
				{ startIndex: 31, type: 'number.cpp' },
				{ startIndex: 32, type: 'delimiter.cpp' }
			]
		}
	],

	[
		{
			line: 'int x = /* comment */ 1; */',
			tokens: [
				{ startIndex: 0, type: 'keyword.int.cpp' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'identifier.cpp' },
				{ startIndex: 5, type: '' },
				{ startIndex: 6, type: 'delimiter.cpp' },
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'comment.cpp' },
				{ startIndex: 21, type: '' },
				{ startIndex: 22, type: 'number.cpp' },
				{ startIndex: 23, type: 'delimiter.cpp' },
				{ startIndex: 24, type: '' }
			]
		}
	],

	[
		{
			line: 'x = /**/;',
			tokens: [
				{ startIndex: 0, type: 'identifier.cpp' },
				{ startIndex: 1, type: '' },
				{ startIndex: 2, type: 'delimiter.cpp' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'comment.cpp' },
				{ startIndex: 8, type: 'delimiter.cpp' }
			]
		}
	],

	[
		{
			line: 'x = /*/;',
			tokens: [
				{ startIndex: 0, type: 'identifier.cpp' },
				{ startIndex: 1, type: '' },
				{ startIndex: 2, type: 'delimiter.cpp' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'comment.cpp' }
			]
		}
	],

	// Numbers
	[
		{
			line: '0',
			tokens: [{ startIndex: 0, type: 'number.cpp' }]
		}
	],

	[
		{
			line: '12l',
			tokens: [{ startIndex: 0, type: 'number.cpp' }]
		}
	],

	[
		{
			line: '34U',
			tokens: [{ startIndex: 0, type: 'number.cpp' }]
		}
	],

	[
		{
			line: '55LL',
			tokens: [{ startIndex: 0, type: 'number.cpp' }]
		}
	],

	[
		{
			line: '34ul',
			tokens: [{ startIndex: 0, type: 'number.cpp' }]
		}
	],

	[
		{
			line: '55llU',
			tokens: [{ startIndex: 0, type: 'number.cpp' }]
		}
	],

	[
		{
			line: "5'5llU",
			tokens: [{ startIndex: 0, type: 'number.cpp' }]
		}
	],

	[
		{
			line: "100'000'000",
			tokens: [{ startIndex: 0, type: 'number.cpp' }]
		}
	],

	[
		{
			line: "0x100'aafllU",
			tokens: [{ startIndex: 0, type: 'number.hex.cpp' }]
		}
	],

	[
		{
			line: "0342'325",
			tokens: [{ startIndex: 0, type: 'number.octal.cpp' }]
		}
	],

	[
		{
			line: '0x123',
			tokens: [{ startIndex: 0, type: 'number.hex.cpp' }]
		}
	],

	[
		{
			line: '23.5',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '23.5e3',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '23.5E3',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '23.5F',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '23.5f',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '1.72E3F',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '1.72E3f',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '1.72e3F',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '1.72e3f',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '23.5L',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '23.5l',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '1.72E3L',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '1.72E3l',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '1.72e3L',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '1.72e3l',
			tokens: [{ startIndex: 0, type: 'number.float.cpp' }]
		}
	],

	[
		{
			line: '0+0',
			tokens: [
				{ startIndex: 0, type: 'number.cpp' },
				{ startIndex: 1, type: 'delimiter.cpp' },
				{ startIndex: 2, type: 'number.cpp' }
			]
		}
	],

	[
		{
			line: '100+10',
			tokens: [
				{ startIndex: 0, type: 'number.cpp' },
				{ startIndex: 3, type: 'delimiter.cpp' },
				{ startIndex: 4, type: 'number.cpp' }
			]
		}
	],

	[
		{
			line: '0 + 0',
			tokens: [
				{ startIndex: 0, type: 'number.cpp' },
				{ startIndex: 1, type: '' },
				{ startIndex: 2, type: 'delimiter.cpp' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'number.cpp' }
			]
		}
	],

	// Monarch Generated
	[
		{
			line: '#include<iostream>',
			tokens: [
				{ startIndex: 0, type: 'keyword.directive.include.cpp' },
				{ startIndex: 8, type: 'keyword.directive.include.begin.cpp' },
				{ startIndex: 9, type: 'string.include.identifier.cpp' },
				{ startIndex: 17, type: 'keyword.directive.include.end.cpp' }
			]
		},
		{
			line: '#include "/path/to/my/file.h"',
			tokens: [
				{ startIndex: 0, type: 'keyword.directive.include.cpp' },
				{ startIndex: 8, type: '' },
				{ startIndex: 9, type: 'keyword.directive.include.begin.cpp' },
				{ startIndex: 10, type: 'string.include.identifier.cpp' },
				{ startIndex: 28, type: 'keyword.directive.include.end.cpp' }
			]
		},
		{
			line: '',
			tokens: []
		},
		{
			line: '#ifdef VAR',
			tokens: [
				{ startIndex: 0, type: 'keyword.directive.cpp' },
				{ startIndex: 6, type: '' },
				{ startIndex: 7, type: 'identifier.cpp' }
			]
		},
		{
			line: '#define SUM(A,B) (A) + (B)',
			tokens: [
				{ startIndex: 0, type: 'keyword.directive.cpp' },
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'identifier.cpp' },
				{ startIndex: 11, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 12, type: 'identifier.cpp' },
				{ startIndex: 13, type: 'delimiter.cpp' },
				{ startIndex: 14, type: 'identifier.cpp' },
				{ startIndex: 15, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 16, type: '' },
				{ startIndex: 17, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 18, type: 'identifier.cpp' },
				{ startIndex: 19, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 20, type: '' },
				{ startIndex: 21, type: 'delimiter.cpp' },
				{ startIndex: 22, type: '' },
				{ startIndex: 23, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 24, type: 'identifier.cpp' },
				{ startIndex: 25, type: 'delimiter.parenthesis.cpp' }
			]
		},
		{
			line: '',
			tokens: []
		},
		{
			line: 'int main(int argc, char** argv)',
			tokens: [
				{ startIndex: 0, type: 'keyword.int.cpp' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'identifier.cpp' },
				{ startIndex: 8, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 9, type: 'keyword.int.cpp' },
				{ startIndex: 12, type: '' },
				{ startIndex: 13, type: 'identifier.cpp' },
				{ startIndex: 17, type: 'delimiter.cpp' },
				{ startIndex: 18, type: '' },
				{ startIndex: 19, type: 'keyword.char.cpp' },
				{ startIndex: 23, type: '' },
				{ startIndex: 26, type: 'identifier.cpp' },
				{ startIndex: 30, type: 'delimiter.parenthesis.cpp' }
			]
		},
		{
			line: '{',
			tokens: [{ startIndex: 0, type: 'delimiter.curly.cpp' }]
		},
		{
			line: '	return 0;',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 1, type: 'keyword.return.cpp' },
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'number.cpp' },
				{ startIndex: 9, type: 'delimiter.cpp' }
			]
		},
		{
			line: '}',
			tokens: [{ startIndex: 0, type: 'delimiter.curly.cpp' }]
		},
		{
			line: '',
			tokens: []
		},
		{
			line: 'namespace TestSpace',
			tokens: [
				{ startIndex: 0, type: 'keyword.namespace.cpp' },
				{ startIndex: 9, type: '' },
				{ startIndex: 10, type: 'identifier.cpp' }
			]
		},
		{
			line: '{',
			tokens: [{ startIndex: 0, type: 'delimiter.curly.cpp' }]
		},
		{
			line: '	using Asdf.CDE;',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 1, type: 'keyword.using.cpp' },
				{ startIndex: 6, type: '' },
				{ startIndex: 7, type: 'identifier.cpp' },
				{ startIndex: 11, type: 'delimiter.cpp' },
				{ startIndex: 12, type: 'identifier.cpp' },
				{ startIndex: 15, type: 'delimiter.cpp' }
			]
		},
		{
			line: '	template <typename T>',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 1, type: 'keyword.template.cpp' },
				{ startIndex: 9, type: '' },
				{ startIndex: 10, type: 'delimiter.angle.cpp' },
				{ startIndex: 11, type: 'keyword.typename.cpp' },
				{ startIndex: 19, type: '' },
				{ startIndex: 20, type: 'identifier.cpp' },
				{ startIndex: 21, type: 'delimiter.angle.cpp' }
			]
		},
		{
			line: '	class CoolClass : protected BaseClass',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 1, type: 'keyword.class.cpp' },
				{ startIndex: 6, type: '' },
				{ startIndex: 7, type: 'identifier.cpp' },
				{ startIndex: 16, type: '' },
				{ startIndex: 17, type: 'delimiter.cpp' },
				{ startIndex: 18, type: '' },
				{ startIndex: 19, type: 'keyword.protected.cpp' },
				{ startIndex: 28, type: '' },
				{ startIndex: 29, type: 'identifier.cpp' }
			]
		},
		{
			line: '	{',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 1, type: 'delimiter.curly.cpp' }
			]
		},
		{
			line: '		private:',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 2, type: 'keyword.private.cpp' },
				{ startIndex: 9, type: 'delimiter.cpp' }
			]
		},
		{
			line: '		',
			tokens: [{ startIndex: 0, type: '' }]
		},
		{
			line: '		static T field;',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 2, type: 'keyword.static.cpp' },
				{ startIndex: 8, type: '' },
				{ startIndex: 9, type: 'identifier.cpp' },
				{ startIndex: 10, type: '' },
				{ startIndex: 11, type: 'identifier.cpp' },
				{ startIndex: 16, type: 'delimiter.cpp' }
			]
		},
		{
			line: '		',
			tokens: [{ startIndex: 0, type: '' }]
		},
		{
			line: '		public:',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 2, type: 'keyword.public.cpp' },
				{ startIndex: 8, type: 'delimiter.cpp' }
			]
		},
		{
			line: '		',
			tokens: [{ startIndex: 0, type: '' }]
		},
		{
			line: '		[[deprecated]]',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 2, type: 'annotation.cpp' }
			]
		},
		{
			line: '		foo method() const override',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 2, type: 'identifier.cpp' },
				{ startIndex: 5, type: '' },
				{ startIndex: 6, type: 'identifier.cpp' },
				{ startIndex: 12, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 14, type: '' },
				{ startIndex: 15, type: 'keyword.const.cpp' },
				{ startIndex: 20, type: '' },
				{ startIndex: 21, type: 'keyword.override.cpp' }
			]
		},
		{
			line: '		{',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 2, type: 'delimiter.curly.cpp' }
			]
		},
		{
			line: '			auto s = new Bar();',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 3, type: 'keyword.auto.cpp' },
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'identifier.cpp' },
				{ startIndex: 9, type: '' },
				{ startIndex: 10, type: 'delimiter.cpp' },
				{ startIndex: 11, type: '' },
				{ startIndex: 12, type: 'keyword.new.cpp' },
				{ startIndex: 15, type: '' },
				{ startIndex: 16, type: 'identifier.cpp' },
				{ startIndex: 19, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 21, type: 'delimiter.cpp' }
			]
		},
		{
			line: '			',
			tokens: [{ startIndex: 0, type: '' }]
		},
		{
			line: '			if (s.field) {',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 3, type: 'keyword.if.cpp' },
				{ startIndex: 5, type: '' },
				{ startIndex: 6, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 7, type: 'identifier.cpp' },
				{ startIndex: 8, type: 'delimiter.cpp' },
				{ startIndex: 9, type: 'identifier.cpp' },
				{ startIndex: 14, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 15, type: '' },
				{ startIndex: 16, type: 'delimiter.curly.cpp' }
			]
		},
		{
			line: '				for(const auto & b : s.field) {',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 4, type: 'keyword.for.cpp' },
				{ startIndex: 7, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 8, type: 'keyword.const.cpp' },
				{ startIndex: 13, type: '' },
				{ startIndex: 14, type: 'keyword.auto.cpp' },
				{ startIndex: 18, type: '' },
				{ startIndex: 19, type: 'delimiter.cpp' },
				{ startIndex: 20, type: '' },
				{ startIndex: 21, type: 'identifier.cpp' },
				{ startIndex: 22, type: '' },
				{ startIndex: 23, type: 'delimiter.cpp' },
				{ startIndex: 24, type: '' },
				{ startIndex: 25, type: 'identifier.cpp' },
				{ startIndex: 26, type: 'delimiter.cpp' },
				{ startIndex: 27, type: 'identifier.cpp' },
				{ startIndex: 32, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 33, type: '' },
				{ startIndex: 34, type: 'delimiter.curly.cpp' }
			]
		},
		{
			line: '					break;',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 5, type: 'keyword.break.cpp' },
				{ startIndex: 10, type: 'delimiter.cpp' }
			]
		},
		{
			line: '				}',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 4, type: 'delimiter.curly.cpp' }
			]
		},
		{
			line: '			}',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 3, type: 'delimiter.curly.cpp' }
			]
		},
		{
			line: '		}',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 2, type: 'delimiter.curly.cpp' }
			]
		},
		{
			line: '		',
			tokens: [{ startIndex: 0, type: '' }]
		},
		{
			line: '		std::string s = "hello wordld\\n";',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 2, type: 'identifier.cpp' },
				{ startIndex: 5, type: '' },
				{ startIndex: 7, type: 'identifier.cpp' },
				{ startIndex: 13, type: '' },
				{ startIndex: 14, type: 'identifier.cpp' },
				{ startIndex: 15, type: '' },
				{ startIndex: 16, type: 'delimiter.cpp' },
				{ startIndex: 17, type: '' },
				{ startIndex: 18, type: 'string.cpp' },
				{ startIndex: 31, type: 'string.escape.cpp' },
				{ startIndex: 33, type: 'string.cpp' },
				{ startIndex: 34, type: 'delimiter.cpp' }
			]
		},
		{
			line: '		',
			tokens: [{ startIndex: 0, type: '' }]
		},
		{
			line: "		int number = 123'123'123Ull;",
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 2, type: 'keyword.int.cpp' },
				{ startIndex: 5, type: '' },
				{ startIndex: 6, type: 'identifier.cpp' },
				{ startIndex: 12, type: '' },
				{ startIndex: 13, type: 'delimiter.cpp' },
				{ startIndex: 14, type: '' },
				{ startIndex: 15, type: 'number.cpp' },
				{ startIndex: 29, type: 'delimiter.cpp' }
			]
		},
		{
			line: '	}',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 1, type: 'delimiter.curly.cpp' }
			]
		},
		{
			line: '}',
			tokens: [{ startIndex: 0, type: 'delimiter.curly.cpp' }]
		},
		{
			line: '',
			tokens: []
		},
		{
			line: '#endif',
			tokens: [{ startIndex: 0, type: 'keyword.directive.cpp' }]
		},
		{
			line: '#    ifdef VAR',
			tokens: [
				{ startIndex: 0, type: 'keyword.directive.cpp' },
				{ startIndex: 10, type: '' },
				{ startIndex: 11, type: 'identifier.cpp' }
			]
		},
		{
			line: '#	define SUM(A,B) (A) + (B)',
			tokens: [
				{ startIndex: 0, type: 'keyword.directive.cpp' },
				{ startIndex: 8, type: '' },
				{ startIndex: 9, type: 'identifier.cpp' },
				{ startIndex: 12, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 13, type: 'identifier.cpp' },
				{ startIndex: 14, type: 'delimiter.cpp' },
				{ startIndex: 15, type: 'identifier.cpp' },
				{ startIndex: 16, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 17, type: '' },
				{ startIndex: 18, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 19, type: 'identifier.cpp' },
				{ startIndex: 20, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 21, type: '' },
				{ startIndex: 22, type: 'delimiter.cpp' },
				{ startIndex: 23, type: '' },
				{ startIndex: 24, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 25, type: 'identifier.cpp' },
				{ startIndex: 26, type: 'delimiter.parenthesis.cpp' }
			]
		},
		{
			line: 'uR"V0G0N(abc)V0G0N"def',
			tokens: [
				{ startIndex: 0, type: 'string.raw.begin.cpp' },
				{ startIndex: 9, type: 'string.raw.cpp' },
				{ startIndex: 12, type: 'string.raw.end.cpp' },
				{ startIndex: 19, type: 'identifier.cpp' }
			]
		}
	],

	// https://github.com/microsoft/monaco-editor/issues/1951
	[
		{
			line: 'auto sv = R"({ "message": "Hello World" })""\\n"sv;',
			tokens: [
				{ startIndex: 0, type: 'keyword.auto.cpp' },
				{ startIndex: 4, type: '' },
				{ startIndex: 5, type: 'identifier.cpp' },
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'delimiter.cpp' },
				{ startIndex: 9, type: '' },
				{ startIndex: 10, type: 'string.raw.begin.cpp' },
				{ startIndex: 13, type: 'string.raw.cpp' },
				{ startIndex: 41, type: 'string.raw.end.cpp' },
				{ startIndex: 43, type: 'string.cpp' },
				{ startIndex: 44, type: 'string.escape.cpp' },
				{ startIndex: 46, type: 'string.cpp' },
				{ startIndex: 47, type: 'identifier.cpp' },
				{ startIndex: 49, type: 'delimiter.cpp' }
			]
		},
		{
			line: '    // This is a comment, not a string',
			tokens: [
				{ startIndex: 0, type: '' },
				{ startIndex: 4, type: 'comment.cpp' }
			]
		}
	],

	// Annotations
	[
		{
			line: '[[nodiscard]]',
			tokens: [{ startIndex: 0, type: 'annotation.cpp' }]
		}
	],
	[
		{
			// Example from http://eel.is/c++draft/dcl.attr
			line: '[[using CC: opt(1), debug]]',
			tokens: [
				{ startIndex: 0, type: 'annotation.cpp' }, // [[
				{ startIndex: 2, type: 'keyword.cpp' }, // using
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'annotation.cpp' }, // CC
				{ startIndex: 10, type: 'delimiter.cpp' }, // colon
				{ startIndex: 11, type: '' },
				{ startIndex: 12, type: 'annotation.cpp' }, // opt
				{ startIndex: 15, type: 'delimiter.parenthesis.cpp' }, // (
				{ startIndex: 16, type: 'annotation.cpp' }, // 1
				{ startIndex: 17, type: 'delimiter.parenthesis.cpp' }, // )
				{ startIndex: 18, type: 'delimiter.cpp' }, // ,
				{ startIndex: 19, type: '' },
				{ startIndex: 20, type: 'annotation.cpp' } // debug]]
			]
		}
	],
	[
		// Multiline and comments.
		{
			line: '[[nodiscard /*commented*/',
			tokens: [
				{ startIndex: 0, type: 'annotation.cpp' },
				{ startIndex: 11, type: '' },
				{ startIndex: 12, type: 'comment.cpp' }
			]
		},
		{
			line: ']] int i;',
			tokens: [
				{ startIndex: 0, type: 'annotation.cpp' },
				{ startIndex: 2, type: '' },
				{ startIndex: 3, type: 'keyword.int.cpp' },
				{ startIndex: 6, type: '' },
				{ startIndex: 7, type: 'identifier.cpp' },
				{ startIndex: 8, type: 'delimiter.cpp' }
			]
		}
	],
	[
		// We don't support newlines between annotation square brackets, but we do support other whitespace.
		{
			line: '[ [nodiscard] ]',
			tokens: [{ startIndex: 0, type: 'annotation.cpp' }]
		}
	],

	// Preprocessor directives with whitespace inamongst the characters,
	// and crucially checking with whitespace before the initial #.
	[
		{
			line: ' # if defined(SOMETHING)',
			tokens: [
				{ startIndex: 0, type: 'keyword.directive.cpp' },
				{ startIndex: 5, type: '' },
				{ startIndex: 6, type: 'identifier.cpp' },
				{ startIndex: 13, type: 'delimiter.parenthesis.cpp' },
				{ startIndex: 14, type: 'identifier.cpp' },
				{ startIndex: 23, type: 'delimiter.parenthesis.cpp' }
			]
		},
		{
			line: '        #include <io.h>',
			tokens: [
				{ startIndex: 0, type: 'keyword.directive.include.cpp' },
				{ startIndex: 16, type: '' },
				{ startIndex: 17, type: 'keyword.directive.include.begin.cpp' },
				{ startIndex: 18, type: 'string.include.identifier.cpp' },
				{ startIndex: 22, type: 'keyword.directive.include.end.cpp' }
			]
		},
		{
			line: '      #  include <io.h>',
			tokens: [
				{ startIndex: 0, type: 'keyword.directive.include.cpp' },
				{ startIndex: 16, type: '' },
				{ startIndex: 17, type: 'keyword.directive.include.begin.cpp' },
				{ startIndex: 18, type: 'string.include.identifier.cpp' },
				{ startIndex: 22, type: 'keyword.directive.include.end.cpp' }
			]
		}
	],

	[
		// microsoft/monaco-editor#2497 : comment continuation highlighting
		{
			line: '// this is a comment \\',
			tokens: [{ startIndex: 0, type: 'comment.cpp' }]
		},
		{
			line: 'this is still a comment',
			tokens: [{ startIndex: 0, type: 'comment.cpp' }]
		},
		{
			line: 'int x = 1;',
			tokens: [
				{ startIndex: 0, type: 'keyword.int.cpp' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'identifier.cpp' },
				{ startIndex: 5, type: '' },
				{ startIndex: 6, type: 'delimiter.cpp' },
				{ startIndex: 7, type: '' },
				{ startIndex: 8, type: 'number.cpp' },
				{ startIndex: 9, type: 'delimiter.cpp' }
			]
		}
	]
]);
