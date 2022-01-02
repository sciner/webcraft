from pydub import AudioSegment
import json
import os
from io import StringIO

def get_name_no_ext(filename):
    pathname, extension = os.path.splitext(filename)
    filename = pathname.split('/')
    return filename[-1]

filelist = os.listdir("../")

offset = 0
sprite = dict()
sound_final = None
for file in filelist:
    print(file)
    if '.ogg' == file[-4:]:
        sound = AudioSegment.from_ogg("../" + file)
    elif '.mp3' == file[-4:]:
        sound = AudioSegment.from_mp3("../" + file)
    else:
        continue
    if not sound_final:
        sound_final = sound
    else:
        sound_final = sound_final + sound
    sound_len = len(sound)
    sprite[get_name_no_ext(file)] = [offset, sound_len - 5]
    offset = offset + sound_len
sound_final.export("./sprite.ogg", format="ogg")
sound_final.export("./sprite.mp3", format="mp3")
io = StringIO()
final_result = dict()
final_result["src"] = ["/sounds/main/sprite.ogg", "/sounds/main/sprite.mp3"]
final_result["sprite"] = sprite

with open('sprite.json', 'w') as f:
    json.dump(final_result, f, indent = 6)
    
print(io.getvalue())