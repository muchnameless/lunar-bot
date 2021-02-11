'use strict';

const HypixelGuild = require('../../src/structures/HypixelGuild');


module.exports = (sequelize, DataTypes) => {
	HypixelGuild.init({
		guildID: {
			type: DataTypes.STRING,
			primaryKey: true,
		},
		roleID: {
			type: DataTypes.STRING,
			defaultValue: null,
			allowNull: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		weightReq: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: true,
		},
		rankRequestChannelID: {
			type: DataTypes.STRING,
			defaultValue: null,
			allowNull: true,
		},
		ranks: {
			type: DataTypes.ARRAY(DataTypes.JSONB), // { name: string, priority: int, weightReq: int, roleID: string }
			defaultValue: null,
			allowNull: true,
		},
	}, {
		sequelize,
		modelName: 'HypixelGuild',
		timestamps: false,
	});

	return HypixelGuild;
};
