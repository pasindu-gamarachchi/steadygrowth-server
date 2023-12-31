const { log } = require("winston");
const logger = require("../utils/logger");
const knex = require("knex")(require("../knexfile"));
const utils = require("../utils/utils");
const {
	evaluatePortfolio,
	evaluateSpendHistory,
	getSortedPortf,
} = require("../utils/portfolioCalculations");
const { getToday } = utils;

const findIndPortfolio = (user_id) => {
	if (!user_id) {
		return { isError: true, errMsg: "Missing user_id" };
	}

	return knex("portfolio")
		.select([
			"port_id",
			"user_id",
			"stock_symbol",
			"purchase_date",
			"purchase_price",
			"purchase_shares",
		])
		.where({ user_id: user_id })
		.andWhere("purchase_shares", ">", 0); //TODO : USE ORDER BY purchase_date here

	then((portf) => {
		return portf;
	}).catch((err) => {
		logger.error(err);
	});
};

const getDataRange = (symb, from, to) => {
	return knex(symb)
		.select(["Date", "Open", "High", "Low", "Close"])
		.where("Date", "<", to)
		.andWhere("Date", ">=", from)
		.then((resp) => {
			// console.log(resp);
			// let combRes = {symb: symb, from:from, to:to, data:resp}
			return resp;
		})
		.catch((err) => {
			logger.error(err.sqlMessage.toLowerCase());
			if (
				err.sqlMessage
					.toLowerCase()
					.includes(
						`table 'stock_data.${req.params.symb}' doesn't exist`
					)
			) {
				logger.error("Missing table");
				return { isError: true, errMsg: "Missing table" };
			}
		});
};

const summary = (req, res) => {
	let port = findIndPortfolio(req.query.user_id);
	let today = getToday();

	port.then((portfRes) => {
		//logger.info(portfRes);
		const proms = [];
		portfRes.forEach((element) => {
			let p = new Promise((resolve, reject) => {
				resolve(
					getDataRange(
						element.stock_symbol,
						element.purchase_date,
						today
					)
				); // TODO UPDATE THIS
			});
			proms.push(p);
		});
		Promise.all(proms).then((vals) => {
			portfRes.forEach((elem, ind) => {
				elem.data = vals[ind];
			});
			let evaledPort = evaluatePortfolio(portfRes);
			res.status(200).json(evaledPort);
		});
	});
};

const spend = (req, res) => {
	let port = findIndPortfolio(req.query.user_id);
	let today = getToday();
	port.then((portfRes) => {
		port = getSortedPortf(portfRes);
		logger.info(portfRes);
		if (portfRes.length === 0) {
			return res.status(200).json([]);
		}
		let p = new Promise((resolve, reject) => {
			resolve(
				getDataRange(port[0].stock_symbol, port[0].purchase_date, today)
			); // TODO UPDATE THIS
		}).then((resp) => {
			// logger.info(p);
			const dateRange = resp.map((elem) => {
				return { date: elem.Date, spend: "" };
			});
			// evaluateSpendHistory
			const spendHist = evaluateSpendHistory(portfRes, dateRange);
			res.status(200).json(spendHist);
		});
		//res.status(200).json(evaluateSpendHistory(portfRes));
	});
};

module.exports = { summary, spend };
