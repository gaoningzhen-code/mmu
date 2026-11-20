sh=open('mmu-shell.html').read()
sh=sh.replace('/*ENGINE*/',open('mmu-engine.js').read()+'\n'+open('mmu-art.js').read()+'\n'+open('mmu-img.js').read()).replace('/*UI*/',open('mmu-ui.js').read())
open('../public/index.html','w').write(sh)
print(len(sh)) # ART
