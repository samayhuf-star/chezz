import subprocess,time,sys
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['node','localserver.js','8099'],cwd='/home/claude/chezz');time.sleep(1)
errs=[]
try:
  with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome',headless=True) if False else p.chromium.launch(executable_path=__import__('shutil').which('google-chrome') or __import__('shutil').which('chromium') or __import__('shutil').which('chromium-browser'),headless=True)
    pg=b.new_page(viewport={'width':430,'height':900});pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/');pg.wait_for_selector('#go')
    assert pg.locator('.tiers button').count()==5
    pg.click('[data-t="4"]');pg.click('[data-l="50"]');print('level 50 selected', pg.inner_text('#go'))
    pg.click('[data-t="0"]');pg.click('[data-l="3"]');pg.click('[data-tc="3"]');pg.click('#go');pg.wait_for_selector('#board .sq')
    time.sleep(.3);pg.screenshot(path='/tmp/s1.png')
    # play e4 by clicking
    def sq(name):
      f=ord(name[0])-97;r=8-int(name[1]);return pg.locator('#board .sq').nth(r*8+f)
    sq('e2').click();sq('e4').click();t0=time.time()
    pg.wait_for_function("window.__chezz.S.moves.length>=2",timeout=5000);print('bot replied in %.0f ms'%((time.time()-t0)*1000))
    # illegal move guard
    sq('a2').click();sq('a5').click();time.sleep(.2);print('moves still',pg.evaluate('window.__chezz.S.moves.length'),'toast:',pg.locator('.toast').first.inner_text() if pg.locator('.toast').count() else None)
    # drag and drop d2-d4
    a=sq('d2').bounding_box();c=sq('d4').bounding_box()
    pg.mouse.move(a['x']+20,a['y']+20);pg.mouse.down();pg.mouse.move(c['x']+20,c['y']+20,steps=6);pg.mouse.up()
    pg.wait_for_function("window.__chezz.S.moves.length>=4",timeout=5000);print('drag ok')
    print('clock',pg.inner_text('#clkBot'),pg.inner_text('#clkTop'))
    time.sleep(1.2);print('clock later',pg.inner_text('#clkBot'))
    # resign needs 2 taps
    pg.click('#bRes');print('arm text',pg.inner_text('#bRes').replace('\n',' '));pg.click('#bRes');pg.wait_for_selector('#endSub')
    print('end:',pg.inner_text('#sheet h2'),'|',pg.inner_text('#endSub'))
    pg.screenshot(path='/tmp/s2.png')
    # profile + ranked game
    pg.click('#viewB');pg.click('.tabs [data-v=me]');pg.fill('#fName','Tester');pg.fill('#fCity','Ghaziabad');pg.fill('#fState','UP');pg.fill('#fCountry','India');pg.click('#saveProf');time.sleep(.6);print(pg.inner_text('#saveNote'))
    pg.click('.tabs [data-v=play]');pg.click('#bNew');pg.wait_for_selector('#go');pg.click('#go');pg.wait_for_selector('#rankFlag .flag.r');print('ranked flag shown')
    pg.screenshot(path='/tmp/s3.png')
    # reload -> resume
    sq('e2').click();sq('e4').click();pg.wait_for_function("window.__chezz.S.moves.length>=2")
    sq('d2').click();sq('d4').click();pg.wait_for_function("window.__chezz.S.moves.length>=4")
    pg.evaluate("window.onbeforeunload=null");pg.reload();pg.wait_for_selector('#rs');pg.click('#rs');time.sleep(.3);print('resumed moves',pg.evaluate('window.__chezz.S.moves.length'))
    pg.click('#bRes');pg.click('#bRes');pg.wait_for_selector('#endSub');time.sleep(1.5);print('ranked resign:',pg.inner_text('#endSub').replace('\n',' '))
    pg.click('#viewB');pg.click('.tabs [data-v=rank]');pg.click('#scopes [data-s=world]');time.sleep(.6);print('LB:',pg.inner_text('#lb').replace('\n',' '))
    b.close()
finally:
  srv.terminate()
print('ERRORS',errs)
