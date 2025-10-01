sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"appfev4/test/integration/pages/OrdersList",
	"appfev4/test/integration/pages/OrdersObjectPage",
	"appfev4/test/integration/pages/Orders_ItemsObjectPage"
], function (JourneyRunner, OrdersList, OrdersObjectPage, Orders_ItemsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('appfev4') + '/test/flp.html#app-preview',
        pages: {
			onTheOrdersList: OrdersList,
			onTheOrdersObjectPage: OrdersObjectPage,
			onTheOrders_ItemsObjectPage: Orders_ItemsObjectPage
        },
        async: true
    });

    return runner;
});

