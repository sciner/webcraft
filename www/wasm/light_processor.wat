(module
 (type $i32_=>_none (func (param i32)))
 (type $none_=>_none (func))
 (import "jsApi" "_asHello" (func $assembly/lib/jsApi/_asHello (param i32)))
 (memory $0 0)
 (export "sayHello" (func $assembly/index/sayHello))
 (export "memory" (memory $0))
 (func $assembly/index/sayHello
  i32.const 42
  call $assembly/lib/jsApi/_asHello
 )
)
