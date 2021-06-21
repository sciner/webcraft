<?php
    
    $f = file_get_contents(__DIR__.'/map_demo.json');
    $f = json_decode($f);
    foreach((array)$f->modifiers as $k => $v) {
        file_put_contents(__DIR__ . '/../server/world/demo/' . $k . '.json', json_encode($v, JSON_UNESCAPED_UNICODE));
    }