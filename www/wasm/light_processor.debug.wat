(module
 (type $i32_=>_none (func (param i32)))
 (type $none_=>_none (func))
 (import "jsApi" "_asHello" (func $assembly/lib/jsApi/_asHello (param i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 16392))
 (global $~lib/memory/__heap_base i32 (i32.const 16392))
 (memory $0 0)
 (table $0 1 funcref)
 (elem $0 (i32.const 1))
 (export "sayHello" (func $assembly/index/sayHello))
 (export "memory" (memory $0))
 (func $assembly/index/sayHello
  i32.const 42
  call $assembly/lib/jsApi/_asHello
 )
)
