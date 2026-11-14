// Numeric RGB palette data from Wootility Web, checked 2026-11-14.
// https://wootility.io/assets/index-BaoALhfv.js
// Wooting's preset names are retained for attribution. The renderer and Studio presets are original.
import { getModel } from "./models.js";
import { layout, paintKey } from "./layout.js";

const referenceMatrices = {
  rainbowFull: [
    ["#ff00bf", "#ff00bf", "#7f00ff", "#0000ff", "#0000ff", "#00ffff", "#00ff7f", "#00ff00", "#00ff00", "#dfff00", "#ffc300", "#ffc300", "#ffc300", "#ffc300", "#ff7f00", "#ff7f00", "#ff3b00", "#ff0000", "#ff0077", "#ff0077", "#ff0077"],
    ["#ff00bf", "#ff00bf", "#7f00ff", "#0000ff", "#0000ff", "#00ffff", "#00ff7f", "#00ff7f", "#00ff00", "#00ff00", "#dfff00", "#dfff00", "#ffc300", "#ffc300", "#ff7f00", "#ff7f00", "#ff3b00", "#ff0000", "#ff0000", "#ff0077", "#ff0077"],
    ["#ff00bf", "#ff00bf", "#7f00ff", "#0000ff", "#0000ff", "#00ffff", "#00ff7f", "#00ff7f", "#00ff00", "#00ff00", "#dfff00", "#dfff00", "#ffc300", "#ffc300", "#ffc300", "#ff7f00", "#ff3b00", "#ff3b00", "#ff0000", "#ff0077", "#ff0077"],
    ["#ff00bf", "#ff00bf", "#7f00ff", "#0000ff", "#0000ff", "#00ffff", "#00ff7f", "#00ff7f", "#00ff00", "#00ff00", "#dfff00", "#dfff00", "#dfff00", "#ffc300", "#ffc300", "#ffc300", "#ffc300", "#ff3b00", "#ff0000", "#ff0077", "#ff0077"],
    ["#ff00bf", "#ff00bf", "#ff00bf", "#7f00ff", "#0000ff", "#0000ff", "#00ffff", "#00ff7f", "#00ff7f", "#00ff00", "#00ff00", "#dfff00", "#dfff00", "#dfff00", "#dfff00", "#ff7f00", "#ff7f00", "#ff3b00", "#ff0000", "#ff0077", "#ff0077"],
    ["#ff00bf", "#ff00bf", "#ff00bf", "#7f00ff", "#7f00ff", "#0000ff", "#00ffff", "#00ff7f", "#00ff7f", "#00ff00", "#00ff00", "#dfff00", "#dfff00", "#ffc300", "#ffc300", "#ffc300", "#ff7f00", "#ff7f00", "#ff3b00", "#ff0000", "#ff0000"],
  ],
  seawave: [
    ["#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0077ff", "#0077ff", "#0077ff", "#0077ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00ff8f", "#00ff8f", "#00ff8f", "#00ff8f", "#6fff00", "#6fff00", "#6fff00", "#6fff00"],
    ["#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0077ff", "#0077ff", "#0077ff", "#0077ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00ff8f", "#00ff8f", "#00ff8f", "#00ff8f", "#6fff00", "#6fff00", "#6fff00", "#6fff00"],
    ["#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0077ff", "#0077ff", "#0077ff", "#0077ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00ff8f", "#00ff8f", "#00ff8f", "#00ff8f", "#6fff00", "#6fff00", "#6fff00", "#6fff00"],
    ["#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0077ff", "#0077ff", "#0077ff", "#0077ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00ff8f", "#00ff8f", "#00ff8f", "#00ff8f", "#6fff00", "#6fff00", "#6fff00", "#6fff00"],
    ["#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0077ff", "#0077ff", "#0077ff", "#0077ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00ff8f", "#00ff8f", "#00ff8f", "#00ff8f", "#6fff00", "#6fff00", "#6fff00", "#6fff00"],
    ["#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0077ff", "#0077ff", "#0077ff", "#0077ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00e3ff", "#00ff8f", "#00ff8f", "#00ff8f", "#00ff8f", "#6fff00", "#6fff00", "#6fff00", "#6fff00"],
  ],
  inferno: [
    ["#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff4300", "#ff4300", "#ff4300", "#ff4300", "#ff7700", "#ff7700", "#ff7700", "#ff7700", "#ffaf00", "#ffaf00", "#ffaf00", "#ffaf00", "#ffef00", "#ffef00", "#ffef00", "#ffef00"],
    ["#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff4300", "#ff4300", "#ff4300", "#ff4300", "#ff7700", "#ff7700", "#ff7700", "#ff7700", "#ffaf00", "#ffaf00", "#ffaf00", "#ffaf00", "#ffef00", "#ffef00", "#ffef00", "#ffef00"],
    ["#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff4300", "#ff4300", "#ff4300", "#ff4300", "#ff7700", "#ff7700", "#ff7700", "#ff7700", "#ffaf00", "#ffaf00", "#ffaf00", "#ffaf00", "#ffef00", "#ffef00", "#ffef00", "#ffef00"],
    ["#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff4300", "#ff4300", "#ff4300", "#ff4300", "#ff7700", "#ff7700", "#ff7700", "#ff7700", "#ffaf00", "#ffaf00", "#ffaf00", "#ffaf00", "#ffef00", "#ffef00", "#ffef00", "#ffef00"],
    ["#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff4300", "#ff4300", "#ff4300", "#ff4300", "#ff7700", "#ff7700", "#ff7700", "#ff7700", "#ffaf00", "#ffaf00", "#ffaf00", "#ffaf00", "#ffef00", "#ffef00", "#ffef00", "#ffef00"],
    ["#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff0000", "#ff4300", "#ff4300", "#ff4300", "#ff4300", "#ff7700", "#ff7700", "#ff7700", "#ff7700", "#ffaf00", "#ffaf00", "#ffaf00", "#ffaf00", "#ffef00", "#ffef00", "#ffef00", "#ffef00"],
  ],
  miami: [
    ["#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#ffe700", "#ffe700", "#ffe700", "#9f00ff"],
    ["#9f00ff", "#ff00b7", "#ff00b7", "#ff00b7", "#ff00b7", "#ff00b7", "#ff00b7", "#ff00b7", "#ff00b7", "#ff00b7", "#ff00b7", "#ff00b7", "#ff00b7", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff"],
    ["#9f00ff", "#00fff7", "#ffe700", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#ff00b7", "#ff00b7", "#ff00b7", "#9f00ff"],
    ["#9f00ff", "#ffe700", "#ffe700", "#ffe700", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#9f00ff", "#9f00ff", "#9f00ff", "#9f00ff", "#ff00b7", "#ff00b7", "#ff00b7", "#9f00ff"],
    ["#9f00ff", "#9f00ff", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#9f00ff", "#9f00ff", "#ffe700", "#ffe700", "#ff00b7", "#ff00b7", "#ff00b7", "#9f00ff"],
    ["#9f00ff", "#9f00ff", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#00fff7", "#9f00ff", "#9f00ff", "#9f00ff", "#ffe700", "#ffe700", "#ffe700", "#ffe700", "#ff00b7", "#ff00b7", "#ffe700"],
  ],
  summerBreeze: [
    ["#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#00ff87"],
    ["#ffcb00", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#ffcb00", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87"],
    ["#ffcb00", "#00ff87", "#e7ff00", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#ffcb00", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87"],
    ["#ffcb00", "#e7ff00", "#e7ff00", "#e7ff00", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#ffcb00", "#ffcb00", "#1fff00", "#1fff00", "#00ff87", "#00ff87", "#00ff87", "#1fff00"],
    ["#ffcb00", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#00ff87", "#ffcb00", "#00ff87", "#e7ff00", "#1fff00", "#00ff87", "#00ff87", "#00ff87", "#00ff87"],
    ["#ffcb00", "#ffcb00", "#ffcb00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#e7ff00", "#ffcb00", "#ffcb00", "#ffcb00", "#ffcb00", "#e7ff00", "#e7ff00", "#e7ff00", "#1fff00", "#00ff87", "#00ff87", "#1fff00"],
  ],
  alternator: [
    ["#fffa00", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#fffa00", "#fffa00", "#fffa00", "#00ffef", "#00ffef", "#00ffef", "#fffa00"],
    ["#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#fffa00", "#00ffef", "#00ffef", "#00ffef", "#fffa00", "#fffa00", "#fffa00", "#fffa00"],
    ["#fffa00", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#fffa00"],
    ["#fffa00", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00fff7", "#fffa00", "#fffa00", "#9f00ff", "#9f00ff", "#00ffef", "#00ffef", "#00ffef", "#9f00ff"],
    ["#fffa00", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00fff7", "#fffa00", "#fffa00", "#00ffef", "#ffe700", "#00ffef", "#00ffef", "#00ffef", "#fffa00"],
    ["#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#00ffef", "#00ffef", "#00ffef", "#ffe700", "#00ffef", "#00ffef", "#ffe700"],
  ],
  alternator80: [
    ["#fffa00", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#fffa00", "#fffa00", "#fffa00", "#00ffef", "#00ffef", "#00ffef", "#fffa00"],
    ["#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#fffa00", "#fffa00", "#00ffef", "#00ffef", "#fffa00", "#fffa00", "#fffa00", "#fffa00"],
    ["#fffa00", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#fffa00"],
    ["#fffa00", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00fff7", "#fffa00", "#fffa00", "#9f00ff", "#9f00ff", "#00ffef", "#00ffef", "#00ffef", "#9f00ff"],
    ["#fffa00", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00ffef", "#00fff7", "#fffa00", "#fffa00", "#00ffef", "#ffe700", "#00ffef", "#00ffef", "#00ffef", "#fffa00"],
    ["#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#fffa00", "#00ffef", "#00ffef", "#00ffef", "#ffe700", "#00ffef", "#00ffef", "#ffe700"],
  ],
  clay: [
    ["#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#ff0091", "#ff0091", "#ff0091", "#ff0091"],
    ["#004eff", "#fe00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#004eff", "#004eff", "#004eff", "#fe00ff", "#fe00ff", "#fe00ff", "#004eff", "#004eff", "#004eff", "#004eff"],
    ["#004eff", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#004eff", "#004eff", "#004eff", "#fe00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#004eff"],
    ["#004eff", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#9f00ff", "#9f00ff", "#fe00ff", "#fe00ff", "#fe00ff", "#9f00ff"],
    ["#004eff", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#ff0091", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#ff0091", "#ffe700", "#fe00ff", "#fe00ff", "#fe00ff", "#004eff"],
    ["#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#004eff", "#ff0091", "#ff0091", "#ff0091", "#ffe700", "#fe00ff", "#004eff", "#ffe700"],
  ],
  lekker: [
    ["#ffc700", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#ffc700", "#ffc700", "#ffc700", "#ffc700"],
    ["#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5"],
    ["#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5"],
    ["#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#ffc700", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5"],
    ["#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#ffc700", "#ffc700", "#ffc700", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5"],
    ["#2ae5a5", "#2ae5a5", "#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#ffc700", "#ffc700", "#ffc700", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5"],
  ],
  lekker80: [
    ["#ffc700", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#ffc700", "#ffc700", "#ffc700", "#ffc700"],
    ["#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5"],
    ["#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5"],
    ["#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#ffc700", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5"],
    ["#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#ffc700", "#ffc700", "#ffc700", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5"],
    ["#2ae5a5", "#2ae5a5", "#2ae5a5", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#2ae5a5", "#ffc700", "#ffc700", "#ffc700", "#f5fffc", "#f5fffc", "#f5fffc", "#2ae5a5"],
  ],
  sunset: [
    ["#ffe300", "#ffdc06", "#ffd50c", "#ffcf12", "#ffc818", "#ffc11e", "#ffba23", "#ffb329", "#ffad2f", "#ffa635", "#ff9f3b", "#ff9841", "#f58c50", "#e97e61", "#dd7172", "#d26383", "#c65694", "#ba48a5", "#ae3bb6", "#a22dc7", "#9720d8"],
    ["#ffe003", "#ffd909", "#ffd20f", "#ffcb14", "#ffc51a", "#ffbe20", "#ffb726", "#ffb02c", "#ffa932", "#ffa338", "#ff9c3e", "#fb9347", "#f08558", "#e47869", "#d86a7a", "#cc5d8b", "#c04f9c", "#b542ad", "#a934be", "#9d27cf", "#9119df"],
    ["#ffdd06", "#ffd60b", "#ffcf11", "#ffc817", "#ffc11d", "#ffbb23", "#ffb429", "#ffad2f", "#ffa635", "#ff9f3b", "#ff9941", "#f68d4f", "#ea7f60", "#de7271", "#d26482", "#c75793", "#bb49a4", "#af3bb5", "#a32ec5", "#9720d6", "#8c13e7"],
    ["#ffd908", "#ffd30e", "#ffcc14", "#ffc51a", "#ffbe20", "#ffb726", "#ffb12c", "#ffaa32", "#ffa338", "#ff9c3d", "#fc9446", "#f08657", "#e57968", "#d96b79", "#cd5e8a", "#c1509b", "#b543ac", "#a935bc", "#9e28cd", "#921ade", "#860def"],
    ["#ffd60b", "#ffcf11", "#ffc917", "#ffc21d", "#ffbb23", "#ffb429", "#ffad2e", "#ffa734", "#ffa03a", "#ff9940", "#f78e4e", "#eb805f", "#df7270", "#d36581", "#c75792", "#bc4aa2", "#b03cb3", "#a42fc4", "#9821d5", "#8c14e6", "#8106f7"],
    ["#ffd30e", "#ffcc14", "#ffc61a", "#ffbf20", "#ffb825", "#ffb12b", "#ffaa31", "#ffa337", "#ff9d3d", "#fd9545", "#f18756", "#e57a67", "#da6c78", "#ce5f89", "#c25199", "#b644aa", "#aa36bb", "#9e29cc", "#931bdd", "#870eee", "#7b00ff"],
  ],
  sunsetCompact: [
    ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ffe200", "#ffd600", "#ffca00", "#ffbd00", "#ffb100", "#ffa400", "#ff9700", "#ff8a00", "#f87a3e", "#ee6a61", "#e35981", "#d4489f", "#c236bc", "#a923da", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ffde00", "#ffd200", "#ffc600", "#ffb900", "#ffad00", "#ffa000", "#ff9300", "#fe8518", "#f57549", "#eb656b", "#df548a", "#cf43a8", "#bb31c5", "#a01ce3", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ffdb00", "#ffce00", "#ffc200", "#ffb600", "#ffa900", "#ff9c00", "#ff8f00", "#fb802c", "#f27054", "#e86075", "#da4f93", "#c93db1", "#b42bce", "#9514ec", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ffd700", "#ffcb00", "#ffbe00", "#ffb200", "#ffa500", "#ff9800", "#ff8b00", "#f97b3a", "#ef6b5f", "#e45b7e", "#d54a9c", "#c338ba", "#ab24d8", "#890af6", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ffd300", "#ffc700", "#ffba00", "#ffae00", "#ffa100", "#ff9400", "#fe8610", "#f67647", "#ec6669", "#e05688", "#d044a5", "#bd32c3", "#a21de1", "#7b00ff", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
  ],
  rainbowCompact: [
    ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ff00bf", "#7f00ff", "#0000ff", "#007fff", "#00ffff", "#00ff7f", "#00ff00", "#7fff00", "#dfff00", "#ffc300", "#ffc300", "#ff7f00", "#ff3b00", "#ff0000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ff00bf", "#7f00ff", "#0000ff", "#007fff", "#00ffff", "#00ff7f", "#00ff00", "#7fff00", "#dfff00", "#ffc300", "#ffc300", "#ff7f00", "#ff3b00", "#ff0000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ff00bf", "#7f00ff", "#0000ff", "#007fff", "#00ffff", "#00ff7f", "#00ff00", "#7fff00", "#dfff00", "#ffc300", "#ffc300", "#ff7f00", "#ff3b00", "#ff0000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ff00bf", "#ff00bf", "#7f00ff", "#0000ff", "#007fff", "#00ffff", "#00ff7f", "#00ff00", "#7fff00", "#dfff00", "#ffc300", "#ffc300", "#ff7f00", "#ff3b00", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ff00bf", "#ff00bf", "#7f00ff", "#000000", "#0000ff", "#00ffff", "#00ff7f", "#00ff00", "#7fff00", "#dfff00", "#ffc300", "#ffc300", "#ff7f00", "#ff3b00", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
  ],
  rainbowKeypad: [
    ["#ff9f00", "#000000", "#f7ff00", "#000000", "#8fff00", "#000000", "#00ff40", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ff5000", "#000000", "#000000", "#000000", "#000000", "#000000", "#00ffbf", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ff0000", "#0000ff", "#000000", "#0000ff", "#000000", "#0000ff", "#00bfff", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#ff0068", "#000000", "#000000", "#000000", "#000000", "#000000", "#0040ff", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#000000", "#ff00bf", "#e700ff", "#000000", "#9f00ff", "#7000ff", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
  ],
};

export const wootilityPresets = [
  { id: "wooting-rainbow", name: "Rainbow", source: "Wootility", matrix: "rainbowFull" },
  { id: "wooting-seawave", name: "Seawave", source: "Wootility", matrix: "seawave" },
  { id: "wooting-inferno", name: "Inferno", source: "Wootility", matrix: "inferno" },
  { id: "wooting-miami", name: "Miami FPS", source: "Wootility", matrix: "miami" },
  { id: "wooting-summer-breeze", name: "Summer Breeze", source: "Wootility", matrix: "summerBreeze" },
  { id: "wooting-alternator", name: "Alternator", source: "Wootility", matrix: "alternator" },
  { id: "wooting-clay", name: "Clay", source: "Wootility", matrix: "clay" },
  { id: "wooting-lekker", name: "Lekker", source: "Wootility", matrix: "lekker" },
  { id: "wooting-sunset", name: "Sunset", source: "Wootility", matrix: "sunset" },
];

export const studioPresets = [
  { id: "wykt", name: "Wykt", description: "Dark navy fading into deep violet", stops: ["#071334", "#141d66", "#301457", "#190a36"] },
  { id: "abyss", name: "Abyss", description: "Deep blue with cold teal edges", stops: ["#031526", "#064568", "#087278"] },
  { id: "amethyst", name: "Amethyst", description: "Plum, violet and lilac", stops: ["#260c42", "#7423aa", "#b065d4"] },
  { id: "aurora", name: "Aurora", description: "Mint through indigo", stops: ["#0b664b", "#24c99a", "#246bb3", "#48277d"] },
  { id: "blue-hour", name: "Blue Hour", description: "Twilight blues and lavender", stops: ["#08214c", "#2359b7", "#7975bd"] },
  { id: "cyber", name: "Cyber", description: "Electric cyan and hot magenta", stops: ["#00bcd4", "#4149ce", "#d51a8f"] },
  { id: "ember-glow", name: "Ember Glow", description: "Burgundy through warm amber", stops: ["#3e0716", "#a72519", "#e59124"] },
  { id: "forest", name: "Forest", description: "Pine, moss and soft jade", stops: ["#082b22", "#27683d", "#79a85a"] },
  { id: "glacier", name: "Glacier", description: "Ice blue with a cool white crest", stops: ["#0b3871", "#40b4dd", "#bfdeec"] },
  { id: "rose-quartz", name: "Rose Quartz", description: "Mulberry, rose and blush", stops: ["#541b48", "#ad4574", "#efabc0"] },
  { id: "sakura", name: "Sakura", description: "Violet dusk with pink blossoms", stops: ["#452552", "#aa5e9c", "#f4b3ce"] },
  { id: "solar-flare", name: "Solar Flare", description: "Deep red, orange and gold", stops: ["#9b102a", "#f15a24", "#e6bd36"] },
  { id: "moonstone", name: "Moonstone", description: "Slate blue and soft silver", stops: ["#1e2940", "#667894", "#c2cbd6"] },
  { id: "toxic", name: "Toxic", description: "Acid green with purple contrast", stops: ["#376b08", "#a8db16", "#692295"] },
].map(preset => ({ ...preset, source: "Studio" }));

export const lightingPresets = [...studioPresets, ...wootilityPresets];

export function sampleGradient(stops, position) {
  const scaled = Math.max(0, Math.min(1, position)) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  const channels = hex => hex.slice(1).match(/../g).map(value => parseInt(value, 16));
  const start = channels(stops[index]);
  const end = channels(stops[index + 1]);
  return "#" + start.map((value, channel) => Math.round(value + (end[channel] - value) * fraction)
    .toString(16).padStart(2, "0")).join("");
}

export function presetColors(preset, family, variant = "ANSI") {
  if (preset.source === "Studio") {
    const width = getModel(family).shape === "pad" ? 5 : getModel(family).shape === "compact" ? 13 :
      getModel(family).shape === "full" ? 20 : 16;
    const colors = Array.from({ length: 6 }, () => Array.from({ length: 21 }, (_, col) => sampleGradient(preset.stops, col / width)));
    for (const key of layout(family, variant).flat().filter(key => !key.gap)) {
      paintKey(colors, key, colors[key.row][key.col], family, variant);
    }
    return colors;
  }
  let matrix = preset.matrix;
  const shape = getModel(family).shape;
  if (preset.id === "wooting-rainbow") matrix = shape === "compact" ? "rainbowCompact" : shape === "pad" ? "rainbowKeypad" : "rainbowFull";
  if (preset.id === "wooting-alternator" && shape === "80") matrix = "alternator80";
  if (preset.id === "wooting-lekker" && shape === "80") matrix = "lekker80";
  if (preset.id === "wooting-sunset" && shape === "compact") matrix = "sunsetCompact";
  return referenceMatrices[matrix].map(row => [...row]);
}
