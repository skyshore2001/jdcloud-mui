DOC=jdcloud-mui.html
OUT=lib/jdcloud-mui.js
OUT_MIN=lib/jdcloud-mui.min.js

all: $(OUT) $(OUT_MIN) $(DOC)

clean:
	-rm -rf $(DOC) $(OUT) $(OUT_MIN)

js: $(OUT)
doc: $(DOC)

$(DOC): $(OUT)
	php tool/jdcloud-gendoc.phar $< > $@

$(OUT): example/index.html src/*
	perl tool/webcc_merge.pl $< > $(OUT)

$(OUT_MIN): $(OUT)
	sh -c tool/jsmin < $< > $@

