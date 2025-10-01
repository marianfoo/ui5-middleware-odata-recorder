using { sap.capire.orders as my } from '../db/schema';
namespace sap.capire.orders.api;

service OrdersService {
  entity Orders as projection on my.Orders;
  entity Customers as projection on my.Customers;

  @odata.draft.bypass
  @requires: [ 'system-user', 'authenticated-user' ]
  entity OrdersNoDraft as projection on my.Orders;

  event OrderChanged {
    product: String;
    deltaQuantity: Integer;
  }

}

service BooksService {
  entity Books as projection on my.Books;
  entity Authors as projection on my.Authors;
}
