from pydub import AudioSegment
import json
import os
from io import StringIO

def get_name_no_ext(filename):
    pathname, extension = os.path.splitext(filename)
    filename = pathname.split('/')
    return filename[-1]

filelist = os.listdir("sounds")

counter = 0
result = dict()
sound_final = None
for file in filelist:
    if 'ogg' in file:
        sound = AudioSegment.from_ogg("sounds/" + file)
    elif 'mp3' in file:
        sound = AudioSegment.from_mp3("sounds/" + file)
    else:
        print("Ext proc not found: " + file[-4:])
        exit()
    if not sound_final:
        sound_final = sound
    else:
        sound_final = sound_final + sound
    sound_len = len(sound)
    result[get_name_no_ext(file)] = [counter, sound_len]
    counter = counter + sound_len
sound_final.export("result.ogg", format="ogg")
sound_final.export("result.mp3", format="mp3")
io = StringIO()
json.dump(result, io)
print(io.getvalue())