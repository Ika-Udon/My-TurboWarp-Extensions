// Name: Key Press Checker
// ID: keyPressChecker
// Description: Check if a specific key is pressed, or when it's pressed/released.
// By: Gemini
// License: MIT

(function (Scratch) {
  "use strict";

  const validKeyboardInputs = [
    { text: "space", value: "space" }, { text: "tab", value: "tab" },
    { text: "up arrow", value: "up arrow" }, { text: "down arrow", value: "down arrow" },
    { text: "right arrow", value: "right arrow" }, { text: "left arrow", value: "left arrow" },
    { text: "enter", value: "enter" }, { text: "backspace", value: "backspace" },
    { text: "delete", value: "delete" }, { text: "shift", value: "shift" },
    { text: "caps lock", value: "caps lock" }, { text: "scroll lock", value: "scroll lock" },
    { text: "control", value: "control" }, { text: "escape", value: "escape" },
    { text: "insert", value: "insert" }, { text: "home", value: "home" }, { text: "end", value: "end" },
    { text: "page up", value: "page up" }, { text: "page down", value: "page down" },
    { text: "F1", value: "f1" }, { text: "F2", value: "f2" }, { text: "F3", value: "f3" }, { text: "F4", value: "f4" },
    { text: "F5", value: "f5" }, { text: "F6", value: "f6" }, { text: "F7", value: "f7" }, { text: "F8", value: "f8" },
    { text: "F9", value: "f9" }, { text: "F10", value: "f10" }, { text: "F11", value: "f11" }, { text: "F12", value: "f12" },
    // アルファベット大文字・小文字
    ...'abcdefghijklmnopqrstuvwxyz'.split('').map(c => ({ text: c, value: c })),
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => ({ text: c, value: c })),
    // 数字
    ...'0123456789'.split('').map(c => ({ text: c, value: c })),
    // 記号
    ...[';', ':', ',', '.', '/', '\\', '\'', '"', '[', ']', '{', '}', '-', '=', '+', '_', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '<', '>', '?', '|', '`', '~'].map(c => ({ text: c, value: c }))
  ];

  class KeyPressChecker {
    constructor() {
      this.previousKeyStates = new Map();
      this.disableFKeyDefault = false; // デフォルトでブラウザの機能ON
      this.fKeyStates = {};
      this._setupFKeyListener();
      this._setupFKeyStateWatcher();
    }

    _setupFKeyStateWatcher() {
      window.addEventListener('keydown', e => {
        if (e.keyCode >= 112 && e.keyCode <= 123) this.fKeyStates[e.keyCode] = true;
      });
      window.addEventListener('keyup', e => {
        if (e.keyCode >= 112 && e.keyCode <= 123) this.fKeyStates[e.keyCode] = false;
      });
    }

    _fKeyNameToKeyCode(key) {
      const n = key.toLowerCase().match(/^f(1[0-2]|[1-9])$/);
      return n ? 111 + parseInt(n[1], 10) : undefined;
    }

    _isFKey(key) {
      return /^f(1[0-2]|[1-9])$/i.test(key);
    }

    _setupFKeyListener() {
      if (this._fKeyHandler) window.removeEventListener('keydown', this._fKeyHandler, true);
      this._fKeyHandler = e => {
        if (this.disableFKeyDefault && /^F(1[0-2]|[1-9])$/.test(e.key)) e.preventDefault();
      };
      window.addEventListener('keydown', this._fKeyHandler, true);
    }

    getInfo() {
      return {
        id: "keyPressChecker",
        name: Scratch.translate("キーチェック"),
        color1: "#81d1f9", color2: "#4088CC", color3: "#306899",
        blocks: [
          {
            opcode: "isKeyPressed",
            blockType: Scratch.BlockType.BOOLEAN,
            text: Scratch.translate("[KEY_OPTION] キーが押された"),
            arguments: { KEY_OPTION: { type: Scratch.ArgumentType.STRING, defaultValue: "space", menu: "keyboardButtons" } }
          },
          "---",
          {
            opcode: "whenKeyHitMoment",
            blockType: Scratch.BlockType.HAT,
            isEdgeActivated: true, // 追加
            text: Scratch.translate("[KEY_OPTION] キーが押された瞬間"),
            arguments: { KEY_OPTION: { type: Scratch.ArgumentType.STRING, defaultValue: "space", menu: "keyboardButtons" } }
          },
          {
            opcode: "whenKeyReleasedMoment",
            blockType: Scratch.BlockType.HAT,
            isEdgeActivated: true, // 追加
            text: Scratch.translate("[KEY_OPTION] キーが離れた瞬間"),
            arguments: { KEY_OPTION: { type: Scratch.ArgumentType.STRING, defaultValue: "space", menu: "keyboardButtons" } }
          },
          {
            opcode: "setFKeyDefaultDisabled",
            blockType: Scratch.BlockType.COMMAND,
            text: Scratch.translate("F1～F12の標準動作を [ONOFF] にする"),
            arguments: { ONOFF: { type: Scratch.ArgumentType.STRING, menu: "onoffMenu", defaultValue: "on" } }
          },
        ],
        menus: {
          keyboardButtons: { acceptReporters: true, items: validKeyboardInputs },
          onoffMenu: {
            acceptReporters: true,
            items: [
              { text: "ON（無効化）", value: "on" },
              { text: "OFF（有効化）", value: "off" }
            ]
          }
        }
      };
    }

    setFKeyDefaultDisabled(args) {
      this.disableFKeyDefault = args.ONOFF === "on";
      this._setupFKeyListener();
    }

    isKeyPressed(args, util) {
      let key = Scratch.Cast.toString(args.KEY_OPTION);
      if (this._isFKey(key)) {
        const code = this._fKeyNameToKeyCode(key);
        if (code !== undefined) return !!this.fKeyStates[code];
      }
      return util.ioQuery("keyboard", "getKeyIsDown", [key]);
    }

    whenKeyHitMoment(args, util) {
      let key = Scratch.Cast.toString(args.KEY_OPTION);
      if (this._isFKey(key)) {
        const code = this._fKeyNameToKeyCode(key);
        return !!this.fKeyStates[code];
      }
      return util.ioQuery("keyboard", "getKeyIsDown", [key]);
    }

    whenKeyReleasedMoment(args, util) {
      let key = Scratch.Cast.toString(args.KEY_OPTION);
      if (this._isFKey(key)) {
        const code = this._fKeyNameToKeyCode(key);
        return !this.fKeyStates[code];
      }
      return !util.ioQuery("keyboard", "getKeyIsDown", [key]);
    }
  }

  Scratch.extensions.register(new KeyPressChecker());
})(Scratch);
