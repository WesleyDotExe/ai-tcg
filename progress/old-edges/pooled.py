# The screen's two seed blocks pooled (ring seeds from 1 + the fresh block from 800001), session 61.
# Each cell: rate for the edge's first-named faction (change from shipped, same seeds). python3 pooled.py > pooled.txt
import json, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "screen"))
load = lambda k, s: json.load(open(f"{k}-{s}.json"))
print("Screen, both seed blocks pooled (5,000 games a W edge, 1,800 an even edge): rate (change from shipped)")
for k in ["NA8", "NA10", "NA11", "NA12", "CS3", "CS7", "CS8", "NA8+CS7", "NA12+CS7"]:
    print(k)
    for tag in ["real", "gate"]:
        cells = []
        for i, e in enumerate(load("shipped", 1)[tag]):
            x = n = bx = bn = 0
            for s in [1, 800001]:
                c, b = load(k, s)[tag][i], load("shipped", s)[tag][i]
                x += c["selfWins"]; n += c["games"]; bx += b["selfWins"]; bn += b["games"]
            cells.append(f"{e['edge']} {100*x/n:.1f} ({100*(x/n-bx/bn):+.1f})")
        print(f"  {tag}: " + " | ".join(cells))
