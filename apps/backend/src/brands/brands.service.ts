import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { CreateBrandDto, UpdateBrandDto } from './brands.controller';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getAllBrands(search?: string) {
    const query = `
      query GetAllBrands($where: brands_bool_exp) {
        brands(
          where: $where
          order_by: { name: asc }
        ) {
          id
          name
          description
          created_at
          updated_at
          items_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const whereClause = search
      ? {
          _or: [
            { name: { _ilike: `%${search}%` } },
            { description: { _ilike: `%${search}%` } },
          ],
        }
      : {};

    const result = await this.hasuraSystemService.executeQuery(query, {
      where: whereClause,
    });

    return result.brands || [];
  }

  async getBrandById(id: string) {
    const query = `
      query GetBrandById($id: uuid!) {
        brands_by_pk(id: $id) {
          id
          name
          description
          created_at
          updated_at
          items_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, { id });
    return result.brands_by_pk;
  }

  async createBrand(createBrandDto: CreateBrandDto) {
    const mutation = `
      mutation CreateBrand($name: String!, $description: String!) {
        insert_brands_one(object: {
          name: $name,
          description: $description
        }) {
          id
          name
          description
          created_at
          updated_at
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(mutation, {
      name: createBrandDto.name,
      description: createBrandDto.description,
    });

    this.logger.log(`Brand created: ${result.insert_brands_one.name}`);
    return result.insert_brands_one;
  }

  async updateBrand(id: string, updateBrandDto: UpdateBrandDto) {
    const mutation = `
      mutation UpdateBrand($id: uuid!, $name: String, $description: String) {
        update_brands_by_pk(
          pk_columns: { id: $id }
          _set: {
            name: $name,
            description: $description,
            updated_at: "now()"
          }
        ) {
          id
          name
          description
          created_at
          updated_at
        }
      }
    `;

    const updateData: any = {};
    if (updateBrandDto.name !== undefined) {
      updateData.name = updateBrandDto.name;
    }
    if (updateBrandDto.description !== undefined) {
      updateData.description = updateBrandDto.description;
    }

    const result = await this.hasuraSystemService.executeMutation(mutation, {
      id,
      ...updateData,
    });

    if (result.update_brands_by_pk) {
      this.logger.log(`Brand updated: ${result.update_brands_by_pk.name}`);
    }
    return result.update_brands_by_pk;
  }

  async deleteBrand(id: string) {
    // First check if brand has associated items
    const checkQuery = `
      query CheckBrandItems($id: uuid!) {
        brands_by_pk(id: $id) {
          id
          name
          items_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const checkResult = await this.hasuraSystemService.executeQuery(
      checkQuery,
      {
        id,
      }
    );

    const brand = checkResult.brands_by_pk;
    if (!brand) {
      return null;
    }

    if (brand.items_aggregate.aggregate.count > 0) {
      throw new Error(
        `Cannot delete brand "${brand.name}" because it has ${brand.items_aggregate.aggregate.count} associated items`
      );
    }

    const mutation = `
      mutation DeleteBrand($id: uuid!) {
        delete_brands_by_pk(id: $id) {
          id
          name
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(mutation, {
      id,
    });

    if (result.delete_brands_by_pk) {
      this.logger.log(`Brand deleted: ${result.delete_brands_by_pk.name}`);
    }
    return result.delete_brands_by_pk;
  }
}
