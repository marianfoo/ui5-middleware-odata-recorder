sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/m/Dialog",
    "sap/m/MessageToast"
], function(Fragment, Dialog, MessageToast) {
    "use strict";

    let booksDialog = null;

    return {
        /**
         * Handler for the custom "Show Available Books" button
         */
        onShowBooks: async function() {
            // Get the books model
            const booksModel = this.getView().getModel("books");

            if (!booksModel) {
                console.error("Books model not found");
                return;
            }

            // Load the dialog fragment if not already loaded
            if (!booksDialog) {
                booksDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "appfev2.ext.fragment.BooksDialog",
                    controller: this
                });

                this.getView().addDependent(booksDialog);
            }

            // Set the model on the dialog
            booksDialog.setModel(booksModel, "books");

            // Open the dialog
            booksDialog.open();
        },

        /**
         * Handler for closing the dialog
         */
        onCloseDialog: function() {
            if (booksDialog) {
                booksDialog.close();
            }
        },

        /**
         * Demo: Load Customers with expanded Orders navigation (OData V2)
         * This demonstrates the expanded navigation recording feature for V2
         * 
         * Usage:
         * 1. Start recording: http://localhost:8080/__recorder/start
         * 2. Click the "Demo: Customer + Orders" button
         * 3. The recorder will save both Customers and Orders to separate files
         */
        onLoadCustomerWithExpandedOrders: function() {
            const oModel = this.getView().getModel();
            const that = this;
            
            // OData V2: Read with $expand
            oModel.read("/Customers", {
                urlParameters: {
                    "$top": "1",
                    "$expand": "Orders"
                },
                success: function(oData) {
                    const aCustomers = oData.results || [];
                    if (aCustomers.length > 0) {
                        const oCustomer = aCustomers[0];
                        const iOrderCount = oCustomer.Orders ? oCustomer.Orders.results.length : 0;
                        
                        console.log("[Demo V2] Expanded navigation test - Customer with Orders:", oCustomer);
                        console.log("[Demo V2] Check localService/mainService/data/ for Customers-demo.json and Orders-demo.json");
                        
                        // Show results in dialog
                        const summary = "Customer: " + oCustomer.name + "\nOrders Count: " + iOrderCount;
                        that._showResultDialog("Customer with Expanded Orders", summary, oCustomer);
                    } else {
                        MessageToast.show("No customers found");
                    }
                },
                error: function(oError) {
                    console.error("[Demo V2] Error loading customer with expanded orders:", oError);
                    MessageToast.show("Error: " + (oError.message || "Failed to load data"));
                }
            });
        },

        /**
         * Demo: Load Orders with expanded customer navigation (OData V2)
         * Tests single entity expansion in V2
         */
        onLoadOrdersWithExpandedCustomer: function() {
            const oModel = this.getView().getModel();
            const that = this;
            
            // OData V2: Read orders with expanded customer
            oModel.read("/Orders", {
                urlParameters: {
                    "$top": "2",
                    "$expand": "customer"
                },
                success: function(oData) {
                    const aOrders = oData.results || [];
                    
                    console.log("[Demo V2] Multiple expands test - Orders:", aOrders);
                    console.log("[Demo V2] Check localService/mainService/data/ for Orders-demo.json and Customers-demo.json");
                    
                    // Build summary
                    let summary = "Loaded " + aOrders.length + " orders:\n\n";
                    aOrders.forEach(function(order, idx) {
                        summary += "Order " + (idx + 1) + ": " + (order.OrderNo || order.ID) + "\n";
                        summary += "  Customer: " + (order.customer ? order.customer.name : "N/A") + "\n\n";
                    });
                    
                    // Show results in dialog
                    that._showResultDialog("Orders with Expanded Customer", summary, aOrders);
                },
                error: function(oError) {
                    console.error("[Demo V2] Error loading orders with expanded customer:", oError);
                    MessageToast.show("Error: " + (oError.message || "Failed to load data"));
                }
            });
        },

        /**
         * Demo: Test deferred navigation (should NOT be extracted)
         * This shows that deferred links are properly ignored
         */
        onLoadOrdersWithDeferredNavigation: function() {
            const oModel = this.getView().getModel();
            const that = this;
            
            // OData V2: Read orders WITHOUT expand - navigations will be deferred
            oModel.read("/Orders", {
                urlParameters: {
                    "$top": "1"
                },
                success: function(oData) {
                    const aOrders = oData.results || [];
                    if (aOrders.length > 0) {
                        const oOrder = aOrders[0];
                        
                        console.log("[Demo V2] Deferred navigation test - Order:", oOrder);
                        console.log("[Demo V2] The 'customer' property should contain __deferred, not be extracted");
                        
                        // Check if customer is deferred
                        const isDeferred = oOrder.customer && oOrder.customer.__deferred;
                        const summary = "Order: " + (oOrder.OrderNo || oOrder.ID) + "\n" +
                                      "Customer navigation: " + (isDeferred ? "DEFERRED (__deferred)" : "NOT deferred") + "\n\n" +
                                      "This demonstrates that deferred links are NOT extracted.";
                        
                        // Show results in dialog
                        that._showResultDialog("Order with Deferred Navigation", summary, oOrder);
                    } else {
                        MessageToast.show("No orders found");
                    }
                },
                error: function(oError) {
                    console.error("[Demo V2] Error loading order:", oError);
                    MessageToast.show("Error: " + (oError.message || "Failed to load data"));
                }
            });
        },

        /**
         * Helper: Show results in a dialog
         */
        _showResultDialog: function(title, summary, data) {
            const sData = JSON.stringify(data, null, 2);
            
            const oDialog = new Dialog({
                title: title,
                contentWidth: "600px",
                contentHeight: "500px",
                resizable: true,
                draggable: true,
                content: [
                    new sap.m.VBox({
                        items: [
                            new sap.m.Text({
                                text: summary
                            }).addStyleClass("sapUiSmallMarginBottom"),
                            new sap.m.Label({
                                text: "Full JSON Data:"
                            }).addStyleClass("sapUiTinyMarginTop"),
                            new sap.m.TextArea({
                                value: sData,
                                rows: 15,
                                width: "100%",
                                editable: false
                            })
                        ]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new sap.m.Button({
                    text: "Close",
                    press: function() {
                        oDialog.close();
                    }
                }),
                afterClose: function() {
                    oDialog.destroy();
                }
            });
            
            oDialog.open();
        }
    };
});

