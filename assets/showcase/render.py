from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess
import argparse
parser=argparse.ArgumentParser(description='Render the Reply showcase from captured local-demo footage.')
parser.add_argument('--from',dest='start',type=float,default=0)
parser.add_argument('--to',dest='end',type=float,default=32)
parser.add_argument('--fps',type=int,default=30)
parser.add_argument('--scale',type=float,default=1)
parser.add_argument('--out',default='docs/media')
args=parser.parse_args()
if not (0<=args.start<args.end<=32 and 1<=args.fps<=60 and 0<args.scale<=1):parser.error('Use 0 <= from < to <= 32, fps 1..60 and scale (0,1].')
SOURCE=Path(__file__).resolve().parent;REPO=SOURCE.parent.parent
ROOT=REPO/'work/showcase-render';ROOT.mkdir(parents=True,exist_ok=True)
CACHE=ROOT/'cache';CACHE.mkdir(exist_ok=True)
FONT=REPO/'assets/brand/fonts/cairo-600.ttf';REGULAR=REPO/'assets/brand/fonts/cairo-400.ttf'
beats=json.loads((SOURCE/'beats.json').read_text())
def run(command,log):
 with (ROOT/log).open('w') as f:subprocess.run(command,check=True,stdout=f,stderr=subprocess.STDOUT)
# Every title is drawn from explicit cue data. These are video graphics, not invented interface frames.
for i,beat in enumerate(beats):
 name=beat['id'];duration=beat['duration']
 canvas=Image.new('RGB',(1920,1080),'#0d0c11');d=ImageDraw.Draw(canvas)
 if name!='closing':
  d.rectangle((159,139,1760,1040),outline='#35323e',width=1)
  d.text((160,1048),'LOCAL DEMO  /  SYNTHETIC INVENTORY  /  NO LIVE MESSAGES',font=ImageFont.truetype(str(REGULAR),19),fill='#ded9e6')
  for dot in range(5):d.ellipse((1660+dot*22,1056,1666+dot*22,1062),fill='#ece5f6' if dot==i else '#35323e')
 bg=CACHE/(name+'-background.png');canvas.save(bg)
 title=Image.new('RGBA',(1600,100),(0,0,0,0));td=ImageDraw.Draw(title)
 td.text((0,0),beat['caption'],font=ImageFont.truetype(str(FONT),54),fill='#ffffff')
 titlepath=CACHE/(name+'-title.png');title.save(titlepath)
 output=CACHE/(name+'-composed.mp4')
 if name=='closing':
  logo=Image.open(REPO/'assets/brand/logos/png/reply-horizontal-white.png').convert('RGBA');logo.thumbnail((560,180),Image.Resampling.LANCZOS)
  canvas.paste(logo,((1920-logo.width)//2,300),logo)
  d=ImageDraw.Draw(canvas)
  def centered(text,y,size,color):
   font=ImageFont.truetype(str(FONT if size>40 else REGULAR),size);box=d.textbbox((0,0),text,font=font);d.text(((1920-(box[2]-box[0]))//2,y),text,font=font,fill=color)
  centered('Explore Reply.',520,58,'#ffffff');centered('github.com/mohamedkbay/REPLY',620,38,'#ded9e6');centered('Arabic + English  /  Light + Dark',710,28,'#ded9e6')
  canvas.save(bg)
  run(['ffmpeg','-y','-hide_banner','-loop','1','-framerate','30','-i',str(bg),'-t',str(duration),'-vf','fade=t=in:st=0:d=0.3,fade=t=out:st=3.65:d=0.35','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(output)],name+'-compose.log')
  continue
 raw=SOURCE/'footage'/(name+'.mp4');x=160;y=140;content='[1:v]setpts=PTS-STARTPTS[ui]'
 if name=='mobile':
  content='[1:v]scale=-2:860,setpts=PTS-STARTPTS[ui]';x='(W-w)/2';y=150
  # Mobile footage is its actual portrait layout, centered; no desktop crop masquerades as a phone.
  canvas=Image.new('RGB',(1920,1080),'#0d0c11');d=ImageDraw.Draw(canvas)
  d.text((160,1048),'LOCAL DEMO  /  RESPONSIVE PHONE LAYOUT',font=ImageFont.truetype(str(REGULAR),19),fill='#ded9e6');d.text((200,360),'Your catalog.',font=ImageFont.truetype(str(FONT),82),fill='#ffffff');d.text((200,470),'In your hand.',font=ImageFont.truetype(str(FONT),82),fill='#e2d8ec');x=1150;canvas.save(bg)
 filters=content+f';[0:v][ui]overlay=x={x}:y={y}:shortest=1[stage];[2:v]format=rgba,fade=t=in:st=0:d=0.22:alpha=1[title];[stage][title]overlay=x=160:y=\'22+22*pow(1-min(t/0.42,1),3)\':shortest=1,format=yuv420p[v]'
 run(['ffmpeg','-y','-hide_banner','-loop','1','-framerate','30','-i',str(bg),'-i',str(raw),'-loop','1','-framerate','30','-i',str(titlepath),'-filter_complex',filters,'-map','[v]','-t',str(duration),'-r','30','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(output)],name+'-compose.log')
# Boundaries remain real recorded transitions; simple cuts keep the product effect unobscured.
rows=['ffconcat version 1.0']+["file '"+str(CACHE/(b['id']+'-composed.mp4'))+"'" for b in beats]
(CACHE/'film.ffconcat').write_text('\n'.join(rows)+'\n')
media=Path(args.out).resolve();media.mkdir(parents=True,exist_ok=True)
film=media/'Reply-Showcase.mp4'
run(['ffmpeg','-y','-hide_banner','-f','concat','-safe','0','-i',str(CACHE/'film.ffconcat'),'-ss',str(args.start),'-vf',f'fps={args.fps},scale={int(1920*args.scale)//2*2}:{int(1080*args.scale)//2*2}:in_range=full:out_range=tv,format=yuv420p,tpad=stop_mode=clone:stop_duration=0.2','-t',str(args.end-args.start),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-color_range','tv','-movflags','+faststart',str(film)],'film.log')
# A short, silent, palette-optimized loop that renders directly in GitHub Markdown.
gif=media/'Reply-Motion-Preview.gif'
run(['ffmpeg','-y','-hide_banner','-i',str(film),'-t',str(min(12,args.end-args.start)),'-filter_complex','fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle','-loop','0',str(gif)],'gif.log')
run(['ffmpeg','-y','-hide_banner','-ss',str(min(3.5,(args.end-args.start)/2)),'-i',str(film),'-frames:v','1','-q:v','2',str(media/'Reply-Showcase-Poster.jpg')],'poster.log')
print(json.dumps({'video':str(film),'gif':str(gif),'duration':args.end-args.start,'fps':args.fps,'scale':args.scale}))
