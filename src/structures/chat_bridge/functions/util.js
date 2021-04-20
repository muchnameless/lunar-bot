'use strict';

module.exports.removeMcFormatting = string => string.replace(/§[0-9a-gk-or]/g, '');
