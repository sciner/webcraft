from pydub import AudioSegment
import json
import os
from io import StringIO

def get_name_no_ext(filename):
    pathname, extension = os.path.splitext(filename)
    filename = pathname.split('/')
    return filename[-1]

filelist = os.listdir("../")

silence_duration = 50
silence = AudioSegment.silent(duration=silence_duration)

sprite = dict()

offset = silence_duration
sound_final = silence

for file in filelist:
    print(file)
    if '.ogg' == file[-4:]:
        sound = AudioSegment.from_ogg("../" + file)
    elif '.mp3' == file[-4:]:
        sound = AudioSegment.from_mp3("../" + file)
    else:
        continue
    if not sound_final:
        sound_final = sound + silence
    else:
        sound_final = sound_final + sound + silence
    sound_len = len(sound)
    sprite[get_name_no_ext(file)] = [offset - silence_duration / 2, sound_len + silence_duration]
    offset = offset + sound_len + silence_duration
sound_final.export("./sprite.ogg", format="ogg")
sound_final.export("./sprite.mp3", format="mp3")
io = StringIO()
final_result = dict()
final_result["src"] = ["/sounds/main/sprite.ogg", "/sounds/main/sprite.mp3"]
final_result["sprite"] = sprite

with open('sprite.json', 'w') as f:
    json.dump(final_result, f, indent = 6)
    
print(io.getvalue())