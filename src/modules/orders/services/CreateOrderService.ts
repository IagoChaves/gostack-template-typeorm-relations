import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if (!findCustomer) {
      throw new AppError('Customer does not exists');
    }

    const productsId = products.map(product => ({ id: product.id }));

    const findProducts = await this.productsRepository.findAllById(productsId);

    if (productsId.length !== findProducts.length) {
      throw new AppError('One or more product was not found');
    }
    const updatedQuantities: IUpdateProductsQuantityDTO[] = [];

    const updatedProducts = findProducts.map(findProduct => {
      const orderProduct = products.find(
        product => product.id === findProduct.id,
      );
      if (orderProduct) {
        if (findProduct.quantity < orderProduct.quantity) {
          throw new AppError(
            `Product ${findProduct.name} has only ${findProduct.quantity} stocks available\n
            You've requested: ${orderProduct.quantity}
            `,
          );
        }
        updatedQuantities.push({
          id: orderProduct.id,
          quantity: findProduct.quantity - orderProduct.quantity,
        });
        return {
          ...findProduct,
          quantity: orderProduct.quantity,
        };
      }
      return findProduct;
    });
    await this.productsRepository.updateQuantity(updatedQuantities);

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: updatedProducts.map(product => ({
        price: product.price,
        product_id: product.id,
        quantity: product.quantity,
      })),
    });
    return order;
  }
}

export default CreateOrderService;
