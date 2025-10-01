using { Currency, User, managed, cuid } from '@sap/cds/common';
namespace sap.capire.orders;

entity Orders : cuid, managed {
  OrderNo  : String(44) @title:'Order Number'; //> readable key
  Items    : Composition of many {
    key ID    : UUID;
    product   : Association to Products;
    quantity  : Integer;
    title     : String; //> intentionally replicated as snapshot from product.title
    price     : Double; //> materialized calculated field
  };
  buyer    : User;
  customer : Association to Customers;
  currency : Currency;
}

/** This is a stand-in for arbitrary ordered Products */
entity Products @(cds.persistence.skip:'always') {
  key ID : String;
}

entity Customers : cuid {
  name        : String(100) @title: 'Customer Name';
  email       : String(100) @title: 'Email';
  country     : String(2) @title: 'Country';
  city        : String(100) @title: 'City';
}

entity Books : cuid, managed {
  title       : String(111) @title: 'Title';
  descr       : String(1111) @title: 'Description';
  author      : Association to Authors @title: 'Author';
  genre       : String(100) @title: 'Genre';
  stock       : Integer @title: 'Stock';
  price       : Decimal(9,2) @title: 'Price';
  currency    : Currency;
}

entity Authors : cuid, managed {
  name        : String(111) @title: 'Name';
  dateOfBirth : Date @title: 'Date of Birth';
  dateOfDeath : Date @title: 'Date of Death';
  placeOfBirth: String(100) @title: 'Place of Birth';
  placeOfDeath: String(100) @title: 'Place of Death';
  books       : Association to many Books on books.author = $self;
}

// this is to ensure we have filled-in currencies
using from '@capire/common';
