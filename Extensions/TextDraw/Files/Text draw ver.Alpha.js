//text-draw ver. Alpha
(function (Scratch) {
  "use strict";
  const vm = Scratch.vm;
  const renderer = vm.renderer;
  const gl = renderer.gl;
  const Skin = renderer.exports.Skin;
  const CanvasMeasurementProvider = renderer.exports.CanvasMeasurementProvider;
  const twgl = renderer.exports.twgl;
  const RenderedTarget = vm.exports.RenderedTarget;

  const CUSTOM_STATE_KEY = Symbol();

  const ALIGN_LEFT = 0;
  const ALIGN_RIGHT = 1;
  const ALIGN_CENTER = 2;

  const DEFAULT_COLOR = "#000000";
  const DEFAULT_FONT = "Sans Serif";
  const DEFAULT_FONT_SIZE = 24;
  const DEFAULT_OUTLINE_WIDTH = 0;
  const DEFAULT_OUTLINE_COLOR = "#000000";
  const DEFAULT_ALPHA = 100;
  const DEFAULT_SPACING = 0;
  const DEFAULT_THICKNESS = 1;
  const DEFAULT_VERTICAL = false; // can be false | "left" | "right"
  const DEFAULT_RESOLUTION = 1;
  const DEFAULT_ANTIALIAS = true;
  const DEFAULT_ANTIALIAS_THRESHOLD = 50;
  const DEFAULT_WRAP_CHARS = 0;
  const DEFAULT_LINE_BREAK_WIDTH = 0; // px, 改行幅（行間 / 列間）

  const FONTS = [
    "Sans Serif",
    "Serif",
    "Handwriting",
    "Marker",
    "Curly",
    "Pixel",
    "Scratch",
  ];

  let globalFrameTime = 0;

  class TextCostumeSkin extends Skin {
    constructor(id, drawable) {
      super(id, renderer);
      this.drawable = drawable;

      this.canvas = document.createElement("canvas");
      this.canvas.width = 0;
      this.canvas.height = 0;
      this.ctx = this.canvas.getContext("2d");

      this.originalCostumeIndex = null;

      this.textRaw = "";
      this.textParsed = [];
      this.color = DEFAULT_COLOR;
      this.alpha = DEFAULT_ALPHA;
      this.fontFamily = DEFAULT_FONT;
      this.fontSize = DEFAULT_FONT_SIZE;
      this.align = ALIGN_LEFT;
      this.outlineWidth = DEFAULT_OUTLINE_WIDTH;
      this.outlineColor = DEFAULT_OUTLINE_COLOR;
      this.spacing = DEFAULT_SPACING;
      this.thickness = DEFAULT_THICKNESS;
      this.vertical = DEFAULT_VERTICAL; // can be false | "left" | "right"
      this.resolution = DEFAULT_RESOLUTION;
      this.antialias = DEFAULT_ANTIALIAS;
      this.antialiasThreshold = DEFAULT_ANTIALIAS_THRESHOLD;
      this.wrapChars = DEFAULT_WRAP_CHARS;
      this.lineBreakWidth = DEFAULT_LINE_BREAK_WIDTH; // 追加: 改行幅

      this.textWidth = vm.runtime.stageWidth;

      this.lines = [];
      this._size = [0, 0];
      this._rotationCenter = [0, 0];

      this._textDirty = true;
      this._textureDirty = true;
      this._renderedAtScale = 1;

      this._texture = null;
    }

    dispose() {
      if (this._texture) {
        gl.deleteTexture(this._texture);
        this._texture = null;
      }
      this.canvas = null;
      this.ctx = null;
      super.dispose();
    }

    get size() {
      if (this._textDirty) this._reflowText();
      return this._size;
    }

    useNearest() {
      return !this.antialias;
    }

    _getFontStyle() {
      return `${this.fontSize}px ${this.fontFamily}, sans-serif`;
    }

    setTextWidth(width) {
      if (width !== this.textWidth) {
        this.textWidth = width;
        this._textDirty = true;
        this.emitWasAltered(); // 追加
      }
    }

    setText(text) {
      const s = String(text);
      if (s !== this.textRaw) {
        this.textRaw = s;
        this.textParsed = parseInline(s, this);
        this._textDirty = true;
        this.emitWasAltered(); // 追加
      }
    }

    setColor(c) {
      if (c !== this.color) {
        this.color = String(c);
        // デフォルト色を変更した場合、フラグメントに組み込まれる初期状態が変わるため
        // テキストの再フローが必要（既存テキストのフラグメント state を更新する）
        this._textDirty = true;
        this._textureDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setAlpha(a) {
      a = Math.max(0, Math.min(100, Number(a)));
      if (a !== this.alpha) {
        this.alpha = a;
        // 初期 alpha を変えるとフラグメントの state に反映させる必要がある
        this._textDirty = true;
        this._textureDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setFontFamily(f) {
      if (f !== this.fontFamily) {
        this.fontFamily = String(f);
        this._textDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setFontSize(n) {
      n = Number(n);
      if (n !== this.fontSize) {
        this.fontSize = n;
        this._textDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setAlign(a) {
      if (a !== this.align) {
        this.align = a;
        this._textureDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setOutlineColor(c) {
      if (c !== this.outlineColor) {
        this.outlineColor = String(c);
        // デフォルトの縁色が変わると、まだインラインで指定されていない文字に影響するため再フロー
        this._textDirty = true;
        this._textureDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setOutlineWidth(w) {
      w = Number(w);
      if (w !== this.outlineWidth) {
        this.outlineWidth = w;
        this._textDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setSpacing(n) {
      n = Number(n);
      if (n !== this.spacing) {
        this.spacing = n;
        this._textDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setThickness(n) {
      n = Math.max(1, Number(n));
      if (n !== this.thickness) {
        this.thickness = n;
        // 太さもフラグメント state として持っているため再フロー
        this._textDirty = true;
        this._textureDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setVertical(v) {
      // normalize incoming value:
      // accept true -> "right" (backward-compatible), false/"false" -> false, "left"/"right" -> kept
      if (v === true) v = "right";
      if (v === "false") v = false;
      // only update when changed
      if (v !== this.vertical) {
        this.vertical = v;
        this._textDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setResolution(n) {
      n = Math.max(0.25, Math.min(4, Number(n)));
      if (n !== this.resolution) {
        this.resolution = n;
        this._textDirty = true;
        this._textureDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setAntialias(on) {
      on = !!on;
      if (on !== this.antialias) {
        this.antialias = on;
        this._textureDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    setAntialiasThreshold(t) {
      t = Math.max(0, Math.min(100, Number(t)));
      if (t !== this.antialiasThreshold) {
        this.antialiasThreshold = t;
        this._textureDirty = true;
        this.emitWasAltered();
      }
    }
    setWrapChars(n) {
      n = Math.max(0, Math.floor(Number(n)));
      if (n !== this.wrapChars) {
        this.wrapChars = n;
        this._textDirty = true;
        this.emitWasAltered(); // 追加
      }
    }
    // 追加: 改行幅 setter
    setLineBreakWidth(n) {
      n = Number(n) || 0;
      if (n !== this.lineBreakWidth) {
        this.lineBreakWidth = n;
        this._textDirty = true;
        this.emitWasAltered();
      }
    }

    _measureProvider() {
      this.ctx.font = this._getFontStyle();
      return new CanvasMeasurementProvider(this.ctx);
    }

    _wrapByChars(text) {
      if (this.wrapChars <= 0) return text.split("\n");
      const out = [];
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.length === 0) {
          out.push("");
          continue;
        }
        for (let i = 0; i < line.length; i += this.wrapChars) {
          out.push(line.slice(i, i + this.wrapChars));
        }
      }
      return out;
    }

    _reflowText() {
      // （関数全体の流れは既存と同じですが、縦書きで spacing を保持して高さに反映するように強化）
      this._textDirty = false;
      this._textureDirty = true;

      const measurement = this._measureProvider();

      const segments = this.textParsed;
      let font = this.fontFamily;
      let size = this.fontSize;
      let spacing = this.spacing;
      let collect = [""], current = 0;

      const flushPush = (s) => {
        collect[current] += s;
      };

      for (const seg of segments) {
        if (seg.cmd) {
          if (seg.type === "n") {
            collect.push("");
            current++;
          } else if (seg.type === "text") {
            flushPush(seg.value);
          } else if (seg.type === "state") {
            const k = seg.key, v = seg.value;
            if (k === "font") {
              font = resolveFontFamily(String(v) || font);
              this.ctx.font = `${size}px ${font}, sans-serif`;
            } else if (k === "spacing") {
              spacing = Number(v) || spacing;
            } else {
              // 他はレンダリング時に反映（state をフラグメントに保持する）
            }
          } else if (seg.type === "font") {
            font = resolveFontFamily(seg.value || font);
            this.ctx.font = `${size}px ${font}, sans-serif`;
          } else if (seg.type === "space") {
            spacing = Number(seg.value) || spacing;
          }
        } else {
          flushPush(seg.text);
        }
      }

      const wrapped = [];
      for (const L of collect) {
        const parts = this._wrapByChars(L);
        wrapped.push(...parts);
      }

      // --- 変更: 各文字に対する状態（color 等）を保持してフラグメント化する ---
      const defaultState = {
        color: this.color,
        alpha: this.alpha,
        font: this.fontFamily,
        spacing: this.spacing,
        thickness: this.thickness,
        outlineColor: this.outlineColor,
        outlineWidth: this.outlineWidth,
        // 追加: fontSize を fragment state に保持する
        fontSize: this.fontSize
      };

      const charStream = [];
      let curState = Object.assign({}, defaultState);
      for (const seg of this.textParsed) {
        if (seg.cmd && seg.type === "text") {
          const txt = seg.value;
          for (let i = 0; i < txt.length; i++) {
            charStream.push({ ch: txt[i], state: Object.assign({}, curState) });
          }
        } else if (seg.cmd && seg.type === "state") {
          const k = seg.key, v = seg.value;
          if (k === "color") curState.color = v;
          else if (k === "alpha") curState.alpha = Number(v);
          else if (k === "font") curState.font = resolveFontFamily(v);
          else if (k === "spacing") curState.spacing = Number(v);
          else if (k === "thickness") curState.thickness = Number(v);
          else if (k === "outlineColor") curState.outlineColor = v;
          else if (k === "outlineWidth") curState.outlineWidth = Number(v);
          // 追加: インラインでの文字サイズ変更を反映
          else if (k === "fontSize") curState.fontSize = Number(v);
        } else if (seg.cmd && seg.type === "n") {
          // newline handled by collect/wrapped
        }
      }

      const lines = [];
      let streamPos = 0;
      for (const lineText of wrapped) {
        const need = lineText.length;
        const fragments = [];
        let acc = "";
        let accState = null;
        for (let k = 0; k < need; k++) {
          const item = charStream[streamPos++] || { ch: "", state: Object.assign({}, defaultState) };
          const ch = item.ch;
          const st = item.state;
          if (accState === null) {
            accState = st;
            acc = ch;
          } else {
            const same =
              accState.color === st.color &&
              accState.alpha === st.alpha &&
              accState.thickness === st.thickness &&
              accState.outlineColor === st.outlineColor &&
              accState.outlineWidth === st.outlineWidth &&
              accState.spacing === st.spacing &&
              (accState.font || this.fontFamily) === (st.font || this.fontFamily) &&
              (accState.fontSize || this.fontSize) === (st.fontSize || this.fontSize);
            if (same) acc += ch;
            else {
              fragments.push({ text: acc, state: accState });
              acc = ch;
              accState = st;
            }
          }
        }
        if (acc !== "" || accState !== null) fragments.push({ text: acc, state: accState || Object.assign({}, defaultState) });

        // 幅と文字毎の spacing / fontSize を収集
        this.ctx.font = `${this.fontSize}px ${this.fontFamily}, sans-serif`;
        const mp = this._measureProvider();
        let w = 0;

        const charSpacings = [];
        const charFontSizes = [];
        for (let fi = 0; fi < fragments.length; fi++) {
          const frag = fragments[fi];
          const fragFont = (frag.state && frag.state.font) ? frag.state.font : this.fontFamily;
          const fragFontSize = (frag.state && frag.state.fontSize != null) ? Number(frag.state.fontSize) : this.fontSize;
          this.ctx.font = `${fragFontSize}px ${fragFont}, sans-serif`;
          for (let ci = 0; ci < frag.text.length; ci++) {
            const ch = frag.text[ci];
            const chW = mp.measureText(ch);
            w += chW;
            if (!this.vertical) {
              if (ci < frag.text.length - 1) {
                w += (frag.state.spacing != null ? frag.state.spacing : this.spacing);
              }
            }
            charSpacings.push(frag.state && frag.state.spacing != null ? frag.state.spacing : this.spacing);
            charFontSizes.push(fragFontSize);
          }
        }

        if (!this.vertical) {
          // 横書きは幅をそのまま
        } else {
          w = Math.max(0, mp.measureText(lineText)) + (this.outlineWidth * 2);
        }

        // 行情報に charSpacings と charFontSizes を保持
        lines.push({ fragments, width: w, text: lineText, charSpacings, charFontSizes });
      }
      // --- ここまで変更 ---

      const lh = (this.fontSize * 8) / 7;
      const padV = this.fontSize / 7;

      // 縦書き時は列幅を文字サイズベースで決め、全体幅は列数に応じて増やす
      if (this.vertical) {
        // 1列あたりの幅（フォントサイズ + 両端の縁余白）
        const columnWidth = this.fontSize + this.outlineWidth * 2;
        const columnGap = this.lineBreakWidth; // 列間として扱う
        const numCols = Math.max(1, lines.length);
        // 各列ごとに必要な高さを計算して最大値を取る（最後の文字が切れないように）
        const colHeights = lines.map(l => {
          const chars = Math.max(0, l.text.length);
          // 元のシンプルな高さ計算に戻す（ユーザ要望）
          const needed = (chars > 0 ? ((chars - 1) * lh + this.fontSize) : this.fontSize) + padV * 2 + this.outlineWidth * 2;
          return Math.max(0, needed);
        });
        const totalHeight = Math.max(1, ...colHeights);
        // 横幅は列数 × 列幅に左右パディングを追加
        const padH = this.outlineWidth;
        const totalWidth = Math.max(1, numCols * columnWidth + Math.max(0, numCols - 1) * columnGap + padH * 2);

        this.lines = lines;
        this._size[0] = totalWidth;
        this._size[1] = totalHeight;
        this._rotationCenter[0] = this._size[0] / 2;
        this._rotationCenter[1] = this.fontSize * 0.9 + padV + this.outlineWidth;
      } else {
        const totalWidth = Math.max(1, ...lines.map(l => l.width)) + this.outlineWidth * 2;
        // 寄せに応じて空白を追加するため、実際の描画幅を2倍に
        const paddedWidth = totalWidth * 2;
        const totalHeight = (lines.length * lh) + Math.max(0, lines.length - 1) * this.lineBreakWidth + padV * 2 + this.outlineWidth * 2;

        this.lines = lines;
        this._size[0] = Math.max(paddedWidth, 1);
        this._size[1] = Math.max(totalHeight, 1);
        this._rotationCenter[0] = this._size[0] / 2;
        this._rotationCenter[1] = this.fontSize * 0.9 + padV + this.outlineWidth;
      }
    }

    _renderAtScale(requestedScale) {
      // ここでは縦書き描画時に各文字の spacing を縦方向に反映するように修正しています。
      this._renderedAtScale = requestedScale;
      this._textureDirty = false;

      const scratchWidth = this._size[0];
      const scratchHeight = this._size[1];

      const scale = Math.max(0.25, Math.min(10, requestedScale * this.resolution));

      this.canvas.width = Math.ceil(scratchWidth * scale);
      this.canvas.height = Math.ceil(scratchHeight * scale);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(scale, scale);
      this.ctx.imageSmoothingEnabled = this.antialias;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // 寄せに応じてオフセットを計算
      let baseOffset = 0;
      if (this.align === ALIGN_LEFT) {
        baseOffset = this._size[0] / 4; // 左寄せは1/4位置から描画開始
      } else if (this.align === ALIGN_RIGHT) {
        baseOffset = (this._size[0] * 3) / 4; // 右寄せは3/4位置から描画開始
      } else {
        baseOffset = this._size[0] / 2; // 中央寄せは中央から描画開始
      }

      this.ctx.font = this._getFontStyle();
      this.ctx.textBaseline = "alphabetic";
      this.ctx.globalAlpha = this.alpha / 100;

      const lh = (this.fontSize * 8) / 7;
      const padV = this.fontSize / 7;

      for (let i = 0; i < this.lines.length; i++) {
        const lineObj = this.lines[i];
        const line = lineObj.text;
        const lineWidth = lineObj.width;

        if (!this.vertical) {
          // 各行ごとにアライメントを適用
          // 変更: 左寄せは「右端を中央に合わせる」、右寄せは「左端を中央に合わせる」
          const centerX = this._size[0] / 2;
          let x;
          if (this.align === ALIGN_LEFT) {
            // 左ブロックは中央線にくっつくように右端を中央に合わせる
            x = centerX - lineWidth - this.outlineWidth;
          } else if (this.align === ALIGN_RIGHT) {
            // 右ブロックは中央線にくっつくように左端を中央に合わせる
            x = centerX + this.outlineWidth;
          } else {
            // 中央寄せは従来通り中央に揃える
            x = (this._size[0] - lineWidth) / 2;
          }
          const y = padV + i * (lh + this.lineBreakWidth) + this.fontSize + this.outlineWidth;

          let cx = x;
          for (const frag of lineObj.fragments) {
            // フラグメントごとの状態を適用
            const st = frag.state || {};
            // 修正: フラグメントに fontSize があればそれを優先してフォント設定する
            const useSize = (st.fontSize != null) ? Number(st.fontSize) : this.fontSize;
            this.ctx.font = `${useSize}px ${st.font || this.fontFamily}, sans-serif`;
            this.ctx.fillStyle = st.color || this.color;
            this.ctx.strokeStyle = st.outlineColor || this.outlineColor;
            this.ctx.lineWidth = (st.outlineWidth != null) ? st.outlineWidth : this.outlineWidth;
            this.ctx.globalAlpha = (st.alpha != null) ? (st.alpha / 100) : (this.alpha / 100);

            for (let j = 0; j < frag.text.length; j++) {
              const ch = frag.text[j];
              drawGlyph(this.ctx, ch, cx, y, this, st);
              const w = this.ctx.measureText(ch).width;
              cx += w + (j < frag.text.length - 1 ? (st.spacing != null ? st.spacing : this.spacing) : 0);
            }
          }
        } else {
          // 縦書きの場合も各列ごとにアライメントを適用
          const columnWidth = this.fontSize + this.outlineWidth * 2;
          const numCols = Math.max(1, this.lines.length);
          const columnGap = this.lineBreakWidth;
          const padH = this.outlineWidth;
          let colLeft;
          if (this.align === ALIGN_LEFT) {
            colLeft = padH + (this.vertical === "left"
              ? (numCols - 1 - i) * (columnWidth + columnGap)
              : i * (columnWidth + columnGap));
          } else if (this.align === ALIGN_RIGHT) {
            colLeft = this._size[0] - columnWidth - padH - (this.vertical === "left"
              ? (numCols - 1 - i) * (columnWidth + columnGap)
              : i * (columnWidth + columnGap));
          } else {
            // 中央
            colLeft = (this._size[0] - numCols * columnWidth - Math.max(0, numCols - 1) * columnGap) / 2
              + (this.vertical === "left"
                ? (numCols - 1 - i) * (columnWidth + columnGap)
                : i * (columnWidth + columnGap));
          }

          const yStart = padV + this.outlineWidth + this.fontSize;

          for (const frag of lineObj.fragments) {
            const st = frag.state || {};
            // 縦書きでは従来の通り global fontSize を使って描画（元の挙動に戻す）
            this.ctx.font = `${this.fontSize}px ${st.font || this.fontFamily}, sans-serif`;
            this.ctx.fillStyle = st.color || this.color;
            this.ctx.strokeStyle = st.outlineColor || this.outlineColor;
            this.ctx.lineWidth = (st.outlineWidth != null) ? st.outlineWidth : this.outlineWidth;
            this.ctx.globalAlpha = (st.alpha != null) ? (st.alpha / 100) : (this.alpha / 100);

            for (let j = 0; j < frag.text.length; j++) {
              const ch = frag.text[j];
              const w = this.ctx.measureText(ch).width;
              const charX = colLeft + (columnWidth - w) / 2;
              const charY = yStart + (function () {
                let offs = 0;
                for (const f of lineObj.fragments) {
                  if (f === frag) break;
                  offs += f.text.length;
                }
                return offs + j;
              })() * lh;
              drawGlyph(this.ctx, ch, charX, charY, this, st);
            }
          }
        }
      }

      if (!this.antialias) {
        const threshold = (this.antialiasThreshold / 100) * 255;
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        for (let i = 3; i < data.length; i += 4) {
          data[i] = data[i] < threshold ? 0 : 255;
        }
        this.ctx.putImageData(imageData, 0, 0);
      }

      if (!this._texture) {
        this._texture = twgl.createTexture(gl, { auto: false, wrap: gl.CLAMP_TO_EDGE });
      }
      this._setTexture(this.canvas);
    }

    updateSilhouette(scale) {
      this.getTexture(scale);
      this._silhouette.unlazy();
    }

    getTexture(scale) {
      const MAX_SCALE = 10;
      const upperScale = scale ? Math.max(Math.abs(scale[0]), Math.abs(scale[1])) : 100;
      const calculatedScale = Math.min(MAX_SCALE, upperScale / 100);
      if (this._textDirty) this._reflowText();
      if (this._textureDirty || calculatedScale !== this._renderedAtScale) {
        this._renderAtScale(calculatedScale);
      }
      return this._texture;
    }
  

    
  }

  function drawGlyph(ctx, ch, x, y, skin, state) {
    // state が与えられればそちらを優先して描画する（ない場合は skin のプロパティを使う）
    const outlineW = (state && state.outlineWidth != null) ? state.outlineWidth : skin.outlineWidth;
    const outlineC = (state && state.outlineColor != null) ? state.outlineColor : skin.outlineColor;
    const color = (state && state.color != null) ? state.color : skin.color;
    const thickness = (state && state.thickness != null) ? state.thickness : skin.thickness;

    if (outlineW > 0) {
      ctx.lineWidth = outlineW;
      ctx.strokeStyle = outlineC;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeText(ch, x, y);
    }
    ctx.fillStyle = color;
    if (thickness <= 1) {
      ctx.fillText(ch, x, y);
    } else {
      const t = Math.min(8, Math.floor(thickness));
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          for (let k = 0; k < t - 1; k++) {
            ctx.fillText(ch, x + dx * 0.5, y + dy * 0.5);
          }
        }
      }
      ctx.fillText(ch, x, y);
    }
  }

  // 追加: 表示名→family を解決するヘルパー
  function resolveFontFamily(name) {
	// null/undefined の場合はデフォルト
	if (!name) return DEFAULT_FONT;
	let n = String(name).replace(/^['"]|['"]$/g, "").trim();
	// まず組み込みフォント名（FONTS）を小文字比較で探す
	for (const f of FONTS) {
		if (f.toLowerCase() === n.toLowerCase()) return f;
	}
	// 次にランタイムのフォントマネージャ（存在すれば）で表示名(name) または family にマッチするものを探す
	if (Scratch && Scratch.vm && Scratch.vm.runtime && Scratch.vm.runtime.fontManager) {
		const fonts = Scratch.vm.runtime.fontManager.getFonts() || [];
		for (const ff of fonts) {
			if (ff.name && ff.name.toLowerCase() === n.toLowerCase()) return ff.family;
			if (ff.family && ff.family.toLowerCase() === n.toLowerCase()) return ff.family;
		}
	}
	// 見つからなければ入力をそのまま返す（ブラウザが解釈できるならそれで表示される）
	return n;
}

  function parseInline(text, skin) {
	const out = [];
	let i = 0;
	while (i < text.length) {
		if (text[i] === "<") {
			const j = text.indexOf(">", i + 1);
			if (j === -1) { out.push({ text: text.slice(i) }); break; }
			const raw = text.slice(i + 1, j).trim();
			const rawLower = raw.toLowerCase();

			// 閉じタグ </tag> または <tag> の判定
			let isClosingTag = false;
			let tagName = '';
			if (rawLower.startsWith('/') && rawLower !== '/n') {
				isClosingTag = true;
				tagName = rawLower.substring(1);
			} else if (!rawLower.includes('=') && rawLower !== '/n') {
				// `/n` は改行なので除外
				const validTagNames = ['color', 'font', 'f_size', 'fsize', 'space', 'alpha', 'thickness', 'edge'];
				if (validTagNames.includes(rawLower)) {
					isClosingTag = true;
					tagName = rawLower;
				}
			}

			if (isClosingTag) {
				let resetType = null;
				if (tagName === 'color') resetType = 'color';
				else if (tagName === 'font') resetType = 'font';
				else if (tagName === 'f_size' || tagName === 'fsize') resetType = 'f_size';
				else if (tagName === 'space') resetType = 'space';
				else if (tagName === 'alpha') resetType = 'alpha';
				else if (tagName === 'thickness') resetType = 'thickness';
				else if (tagName === 'edge') resetType = 'edge';
				
				if (resetType) {
					out.push({ cmd: true, type: 'reset', value: resetType });
					i = j + 1;
					continue;
				}
			}

			if (rawLower === "/n") { out.push({ cmd: true, type: "n" }); i = j + 1; continue; }

			// New: Multi-attribute parsing logic
			const attributeRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
			let match;
			let attributesProcessed = false;

			while ((match = attributeRegex.exec(raw)) !== null) {
				attributesProcessed = true;
				const key = match[1].toLowerCase();
				const value = match[2] || match[3] || match[4] || '';

				if (key === 'color') {
					if (value.toLowerCase() === 'default') {
						out.push({ cmd: true, type: 'reset', value: 'color' });
					} else {
						out.push({ cmd: true, type: "color", value: value });
					}
				} else if (key === 'font') {
					if (value.toLowerCase() === 'default') {
						out.push({ cmd: true, type: 'reset', value: 'font' });
					} else {
						const fname = resolveFontFamily(value);
						out.push({ cmd: true, type: "font", value: fname });
					}
				} else if (key === 'f_size' || key === 'fsize') {
					if (value.toLowerCase() === 'default') {
						out.push({ cmd: true, type: 'reset', value: 'f_size' });
					} else {
						out.push({ cmd: true, type: "f_size", value: value });
					}
				} else if (key === 'space') {
					if (value.toLowerCase() === 'default') {
						out.push({ cmd: true, type: 'reset', value: 'space' });
					} else {
						out.push({ cmd: true, type: "space", value: value });
					}
				} else if (key === 'alpha') {
					if (value.toLowerCase() === 'default') {
						out.push({ cmd: true, type: 'reset', value: 'alpha' });
					} else {
						out.push({ cmd: true, type: "alpha", value: value });
					}
				} else if (key === 'thickness') {
					if (value.toLowerCase() === 'default') {
						out.push({ cmd: true, type: 'reset', value: 'thickness' });
					} else {
						out.push({ cmd: true, type: "thickness", value: value });
					}
				} else if (key === 'c') { // for edge color
					if (value.toLowerCase() === 'default') {
						out.push({ cmd: true, type: 'reset', value: 'outlineColor' });
					} else {
						out.push({ cmd: true, type: 'edge', c: value, t: null });
					}
				} else if (key === 't') { // for edge thickness
					if (value.toLowerCase() === 'default') {
						out.push({ cmd: true, type: 'reset', value: 'outlineWidth' });
					} else {
						out.push({ cmd: true, type: 'edge', c: null, t: value });
					}
				}
			}

			if (attributesProcessed) {
				i = j + 1; continue;
			}
			out.push({ text: text.slice(i, j + 1) }); i = j + 1; continue;
		} else {
			const j = text.indexOf("<", i);
			if (j === -1) { out.push({ text: text.slice(i) }); break; }
			out.push({ text: text.slice(i, j) }); i = j;
		}
	}
	const applied = [];

	const defaultColor = skin ? skin.color : DEFAULT_COLOR;
	const defaultAlpha = skin ? skin.alpha : DEFAULT_ALPHA;
	const defaultFont = skin ? skin.fontFamily : DEFAULT_FONT;
	const defaultSpacing = skin ? skin.spacing : DEFAULT_SPACING;
	const defaultThickness = skin ? skin.thickness : DEFAULT_THICKNESS;
	const defaultOutlineColor = skin ? skin.outlineColor : DEFAULT_OUTLINE_COLOR;
	const defaultOutlineWidth = skin ? skin.outlineWidth : DEFAULT_OUTLINE_WIDTH;
	const defaultFontSize = skin ? skin.fontSize : DEFAULT_FONT_SIZE;

	let color = defaultColor;
	let alpha = defaultAlpha;
	let font = defaultFont;
	let spacing = defaultSpacing;
	let thickness = defaultThickness;
	let outlineColor = defaultOutlineColor;
	let outlineWidth = defaultOutlineWidth;
	let fontSize = defaultFontSize;

	for (const seg of out) {
		if (seg.text != null) {
			applied.push({ cmd: true, type: "text", value: seg.text });
		} else if (seg.cmd) {
			if (seg.type === 'reset') {
				const resetType = seg.value;
				if (resetType === 'color') { color = defaultColor; applied.push({ cmd: true, type: "state", key: "color", value: color }); }
				else if (resetType === 'font') { font = defaultFont; applied.push({ cmd: true, type: "state", key: "font", value: font }); }
				else if (resetType === 'f_size') { fontSize = defaultFontSize; applied.push({ cmd: true, type: "state", key: "fontSize", value: fontSize }); }
				else if (resetType === 'space') { spacing = defaultSpacing; applied.push({ cmd: true, type: "state", key: "spacing", value: spacing }); }
				else if (resetType === 'alpha') { alpha = defaultAlpha; applied.push({ cmd: true, type: "state", key: "alpha", value: alpha }); }
				else if (resetType === 'thickness') { thickness = defaultThickness; applied.push({ cmd: true, type: "state", key: "thickness", value: thickness }); }
				else if (resetType === 'edge') {
					outlineColor = defaultOutlineColor; applied.push({ cmd: true, type: "state", key: "outlineColor", value: outlineColor });
					outlineWidth = defaultOutlineWidth; applied.push({ cmd: true, type: "state", key: "outlineWidth", value: outlineWidth });
				}
				else if (resetType === 'outlineColor') {
					outlineColor = defaultOutlineColor; applied.push({ cmd: true, type: "state", key: "outlineColor", value: outlineColor });
				}
				else if (resetType === 'outlineWidth') {
					outlineWidth = defaultOutlineWidth; applied.push({ cmd: true, type: "state", key: "outlineWidth", value: outlineWidth });
				}
			}
			if (seg.type === "color") { color = seg.value; applied.push({ cmd: true, type: "state", key: "color", value: color }); }
			else if (seg.type === "alpha") { alpha = Number(seg.value); applied.push({ cmd: true, type: "state", key: "alpha", value: alpha }); }
			else if (seg.type === "font") { font = seg.value; applied.push({ cmd: true, type: "state", key: "font", value: font }); }
			else if (seg.type === "space") { spacing = Number(seg.value); applied.push({ cmd: true, type: "state", key: "spacing", value: spacing }); }
			else if (seg.type === "thickness") { thickness = Number(seg.value); applied.push({ cmd: true, type: "state", key: "thickness", value: thickness }); }
			else if (seg.type === "f_size") { 
				const fs = Number(seg.value);
				fontSize = fs; applied.push({ cmd: true, type: "state", key: "fontSize", value: fs }); 
			}
			else if (seg.type === "edge") {
				if (seg.c) { outlineColor = seg.c; applied.push({ cmd: true, type: "state", key: "outlineColor", value: outlineColor }); }
				if (seg.t != null) { outlineWidth = Number(seg.t); applied.push({ cmd: true, type: "state", key: "outlineWidth", value: outlineWidth }); }
			} else if (seg.type === "n") {
				applied.push(seg);
			}
		}
	}
	return applied;
}

  function createTextCostumeSkin(target) {
    const drawable = renderer._allDrawables[target.drawableID];
    const id = renderer._nextSkinId++;
    const skin = new TextCostumeSkin(id, drawable);
    renderer._allSkins[id] = skin;
    return skin;
  }

  vm.runtime.on("BEFORE_EXECUTE", () => {
    globalFrameTime = Date.now();
  });

  class TWText {
    constructor() {
      const ext = this;
      const originalMakeClone = RenderedTarget.prototype.makeClone;
      RenderedTarget.prototype.makeClone = function () {
        const newClone = originalMakeClone.call(this);
        if (ext._hasState(this)) {
          const a = ext._getState(this).skin;
          const b = ext._getState(newClone).skin;
          b.setAlign(a.align);
          b.setColor(a.color);
          b.setAlpha(a.alpha);
          b.setFontFamily(a.fontFamily);
          b.setFontSize(a.fontSize);
          b.setSpacing(a.spacing);
          b.setOutlineColor(a.outlineColor);
          b.setOutlineWidth(a.outlineWidth);
          b.setThickness(a.thickness);
          b.setVertical(a.vertical);
          b.setResolution(a.resolution);
          b.setAntialias(a.antialias);
          b.setAntialiasThreshold(a.antialiasThreshold);
          b.setWrapChars(a.wrapChars);
          b.setTextWidth(a.textWidth);
          b.setText(a.textRaw);
          renderer.updateDrawableSkinId(newClone.drawableID, b.id);
        }
        return newClone;
      };

      vm.runtime.on("targetWasRemoved", (target) => {
        if (this._hasState(target)) {
          const state = this._getState(target);
          renderer.destroySkin(state.skin.id);
        }
      });
    }

    getInfo() {
  return {
    id: "twtextplus",
    name: "テキスト拡張(軽量)",
    color1: "#e2284dff",
    blocks: [
      {
        opcode: "showText",
        blockType: Scratch.BlockType.COMMAND,
        text: "テキストを表示 [TEXT]",
        arguments: {
          TEXT: { type: Scratch.ArgumentType.STRING, defaultValue: "こんにちは <color=\"#ff0000\">赤</n><font=\"Serif\">フォント" }
        },
      },
      {
        opcode: "restoreCostume",
        blockType: Scratch.BlockType.COMMAND,
        text: "もとのコスチュームに戻す",
      },
      "---",
      {
        opcode: "setFont",
        blockType: Scratch.BlockType.COMMAND,
        text: "フォントを [FONT] にする",
        arguments: {
          FONT: { type: Scratch.ArgumentType.STRING, menu: "font" }
        },
      },
      {
        opcode: "setFontSize",
        blockType: Scratch.BlockType.COMMAND,
        text: "文字サイズを [SIZE] にする",
        arguments: { SIZE: { type: Scratch.ArgumentType.NUMBER, defaultValue: DEFAULT_FONT_SIZE } },
      },
      {
        opcode: "setColor",
        blockType: Scratch.BlockType.COMMAND,
        text: "文字の色を [COLOR] にする",
        arguments: { COLOR: { type: Scratch.ArgumentType.COLOR } },
      },
      {
        opcode: "setAlpha",
        blockType: Scratch.BlockType.COMMAND,
        text: "透明度を [ALPHA]% にする",
        arguments: { ALPHA: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 } },
      },
      {
        opcode: "setSpacing",
        blockType: Scratch.BlockType.COMMAND,
        text: "文字間隔を [SPACE] にする",
        arguments: { SPACE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 } },
      },
      {
        opcode: "setLineBreakWidth",
        blockType: Scratch.BlockType.COMMAND,
        text: "改行幅を [N] にする",
        arguments: { N: { type: Scratch.ArgumentType.NUMBER, defaultValue: DEFAULT_LINE_BREAK_WIDTH } },
      },
      {
        opcode: "setAlign",
        blockType: Scratch.BlockType.COMMAND,
        text: "寄せを [ALIGN] にする",
        arguments: {
          ALIGN: { type: Scratch.ArgumentType.STRING, menu: "align" }
        },
      },
      {
        opcode: "setThickness",
        blockType: Scratch.BlockType.COMMAND,
        text: "太さを [N] にする",
        arguments: { N: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 } },
      },
      {
        opcode: "setEdgeColor",
        blockType: Scratch.BlockType.COMMAND,
        text: "縁の色を [COLOR] にする",
        arguments: { COLOR: { type: Scratch.ArgumentType.COLOR } },
      },
      {
        opcode: "setEdgeWidth",
        blockType: Scratch.BlockType.COMMAND,
        text: "縁の太さを [W] にする",
        arguments: { W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 } },
      },
      {
        opcode: "setVertical",
        blockType: Scratch.BlockType.COMMAND,
        text: "縦書きを [ON] にする",
        arguments: {
          ON: { type: Scratch.ArgumentType.STRING, menu: "verticalMenu" }
        },
      },
      {
        opcode: "setResolution",
        blockType: Scratch.BlockType.COMMAND,
        text: "解像度を [R] にする",
        arguments: { R: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 } },
      },
      {
        opcode: "setAntiAlias",
        blockType: Scratch.BlockType.COMMAND,
        text: "アンチエイリアスを [ON] にする",
        arguments: {
          ON: { type: Scratch.ArgumentType.STRING, menu: "onOffMenu" }
        },
      },
      {
        opcode: "setAntiAliasThreshold",
        blockType: Scratch.BlockType.COMMAND,
        text: "アンチエイリアスの閾値を [THRESHOLD] にする",
        arguments: {
          THRESHOLD: { type: Scratch.ArgumentType.NUMBER, defaultValue: 50 }
        },
      },
      {
        opcode: "setWrapChars",
        blockType: Scratch.BlockType.COMMAND,
        text: "改行までの文字数を [N] にする (0は無効)",
        arguments: { N: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 } },
      },
      "---",
      {
        opcode: "setWidth",
        blockType: Scratch.BlockType.COMMAND,
        text: "幅を [W] にする",
        arguments: { W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 200 } },
      },
      "---",
      {
        opcode: "getAttr",
        blockType: Scratch.BlockType.REPORTER,
        text: "テキスト情報 [KEY]",
        arguments: {
          KEY: { type: Scratch.ArgumentType.STRING, menu: "attribute" }
        },
        disableMonitor: true,
      }
    ],
    menus: {
      font: {
        acceptReporters: true,
        items: "getFonts"
      },
      align: {
        acceptReporters: true,
        items: [
          { text: "左", value: "left" },
          { text: "中央", value: "center" },
          { text: "右", value: "right" }
        ]
      },
      verticalMenu: {
        acceptReporters: true,
        items: [
          { text: "横書き", value: "false" },
          { text: "縦書き — 改行で左に追加", value: "left" },
          { text: "縦書き — 改行で右に追加", value: "right" }
        ]
      },
      onOffMenu: {
        acceptReporters: true,
        items: [
          { text: "オン", value: "true" },
          { text: "オフ", value: "false" }
        ]
      },
      attribute: {
        acceptReporters: true,
        items: [
          "font", "size", "color", "alpha", "spacing", "align", "thickness", "edge color", "edge width", "vertical", "resolution", "antialias", "antialias threshold", "width", "text"
        ]
      }
    }
  };
}

    getFonts() {
      const customFonts = Scratch.vm.runtime.fontManager
        ? Scratch.vm.runtime.fontManager.getFonts().map((i) => ({
            text: i.name,
            value: i.family,
          }))
        : [];
      return [...FONTS, ...customFonts, { text: "ランダム", value: "Random" }];
    }

    _getState(target) {
      const state = target[CUSTOM_STATE_KEY];
      if (!state) {
        const newState = { skin: createTextCostumeSkin(target) };
        target[CUSTOM_STATE_KEY] = newState;
        return newState;
      }
      return state;
    }

    _hasState(target) {
      return !!target[CUSTOM_STATE_KEY];
    }

    _renderText(target, state) {
      if (state.skin.originalCostumeIndex === null) {
        state.skin.originalCostumeIndex = target.currentCostume;
      }
      renderer.updateDrawableSkinId(target.drawableID, state.skin.id);
    }

    showText({ TEXT }, util) {
      const state = this._getState(util.target);
      this._renderText(util.target, state);
      const s = Scratch.Cast.toString(TEXT);
      state.skin.setText(s);
      // 変更: インラインの state コマンドをグローバル状態に適用しない（フラグメント単位で描画するため）
    util.runtime.requestRedraw();
    }

    restoreCostume(args, util) {
      if (!this._hasState(util.target)) return;
      const state = this._getState(util.target);
      if (state.skin.originalCostumeIndex != null) {
        util.target.setCostume(state.skin.originalCostumeIndex);
      } else {
        util.target.setCostume(util.target.currentCostume);
      }
      util.runtime.requestRedraw();
    }

    setFont({ FONT }, util) {
      const font = Scratch.Cast.toString(FONT);
      const state = this._getState(util.target);
      if (font === "Random") {
        const possibleFonts = [
          ...FONTS,
          ...(Scratch.vm.runtime.fontManager ? Scratch.vm.runtime.fontManager.getFonts().map(i=>i.family) : [])
        ].filter(i => i !== state.skin.fontFamily);
        if (possibleFonts.length) state.skin.setFontFamily(possibleFonts[Math.floor(Math.random()*possibleFonts.length)]);
      } else {
        state.skin.setFontFamily(font);
      }
    }

    setFontSize({ SIZE }, util) {
      const state = this._getState(util.target);
      state.skin.setFontSize(Scratch.Cast.toNumber(SIZE));
    }

    setColor({ COLOR }, util) {
      
      const state = this._getState(util.target);
      state.skin.setColor(Scratch.Cast.toString(COLOR));
    }

    setAlpha({ ALPHA }, util) {
      const state = this._getState(util.target);
      state.skin.setAlpha(Scratch.Cast.toNumber(ALPHA));
    }

    setSpacing({ SPACE }, util) {
      const state = this._getState(util.target);
      state.skin.setSpacing(Scratch.Cast.toNumber(SPACE));
    }
    // 追加: ブロック本体
    setLineBreakWidth({ N }, util) {
      const state = this._getState(util.target);
      state.skin.setLineBreakWidth(Scratch.Cast.toNumber(N));
    }

    setAlign({ ALIGN }, util) {
      const state = this._getState(util.target);
      if (ALIGN === "center" || ALIGN === "中央") state.skin.setAlign(ALIGN_CENTER);
      else if (ALIGN === "right" || ALIGN === "右") state.skin.setAlign(ALIGN_RIGHT);
      else state.skin.setAlign(ALIGN_LEFT);
    }

    setThickness({ N }, util) {
      const state = this._getState(util.target);
      state.skin.setThickness(Scratch.Cast.toNumber(N));
    }

    setEdgeColor({ COLOR }, util) {
      const state = this._getState(util.target);
      state.skin.setOutlineColor(Scratch.Cast.toString(COLOR));
    }

    setEdgeWidth({ W }, util) {
      const state = this._getState(util.target);
      state.skin.setOutlineWidth(Scratch.Cast.toNumber(W));
    }

    setVertical({ ON }, util) {
      const state = this._getState(util.target);
      // ON は "false"/"left"/"right"（将来 boolean が入っても対応）
      let v = ON;
      if (v === "false") v = false;
      else if (v === true) v = "right";
      state.skin.setVertical(v);
    }

    setResolution({ R }, util) {
      const state = this._getState(util.target);
      state.skin.setResolution(Scratch.Cast.toNumber(R));
    }

setAntiAlias({ ON }, util) {
    const state = this._getState(util.target);
    state.skin.setAntialias(ON === "true");
}

    setAntiAliasThreshold({ THRESHOLD }, util) {
      const state = this._getState(util.target);
      state.skin.setAntialiasThreshold(Scratch.Cast.toNumber(THRESHOLD));
    }

    setWrapChars({ N }, util) {
      const state = this._getState(util.target);
      state.skin.setWrapChars(Scratch.Cast.toNumber(N));
    }

    setWidth({ W }, util) {
      const state = this._getState(util.target);
      state.skin.setTextWidth(Scratch.Cast.toNumber(W));
    }

    getAttr({ KEY }, util) {
      const state = this._getState(util.target);
      const k = Scratch.Cast.toString(KEY);
      if (k === "font") return state.skin.fontFamily;
      if (k === "size") return state.skin.fontSize;
      if (k === "color") return state.skin.color;
      if (k === "alpha") return state.skin.alpha;
      if (k === "spacing") return state.skin.spacing;
      if (k === "align") return state.skin.align === 0 ? "left" : state.skin.align === 1 ? "right" : "center";
      if (k === "thickness") return state.skin.thickness;
      if (k === "edge color") return state.skin.outlineColor;
      if (k === "edge width") return state.skin.outlineWidth;
      if (k === "vertical") return state.skin.vertical;
      if (k === "resolution") return state.skin.resolution;
      if (k === "antialias") return state.skin.antialias;
      if (k === "antialias threshold") return state.skin.antialiasThreshold;
      if (k === "width") return state.skin.textWidth;
      if (k === "lineBreakWidth") return state.skin.lineBreakWidth;
      if (k === "text") return state.skin.textRaw;
      return "";
    }
  }

  Scratch.extensions.register(new TWText());
})(Scratch);
