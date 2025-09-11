import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  CreateSubcategoryDto,
  UpdateSubcategoryDto,
} from './subcategories.controller';

@Injectable()
export class SubcategoriesService {
  private readonly logger = new Logger(SubcategoriesService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getAllSubcategories(search?: string, category_id?: string) {
    const query = `
      query GetAllSubcategories($where: item_sub_categories_bool_exp) {
        item_sub_categories(
          where: $where
          order_by: { name: asc }
        ) {
          id
          name
          description
          item_category_id
          created_at
          updated_at
          item_category {
            id
            name
          }
          items_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    let whereClause: any = {};

    if (search || category_id) {
      whereClause = {
        _and: [],
      };

      if (search) {
        whereClause._and.push({
          _or: [
            { name: { _ilike: `%${search}%` } },
            { description: { _ilike: `%${search}%` } },
          ],
        });
      }

      if (category_id) {
        whereClause._and.push({
          item_category_id: { _eq: parseInt(category_id, 10) },
        });
      }
    }

    const result = await this.hasuraSystemService.executeQuery(query, {
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
    });

    return result.item_sub_categories || [];
  }

  async getSubcategoryById(id: string) {
    const query = `
      query GetSubcategoryById($id: Int!) {
        item_sub_categories_by_pk(id: $id) {
          id
          name
          description
          item_category_id
          created_at
          updated_at
          item_category {
            id
            name
          }
          items_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      id: parseInt(id, 10),
    });
    return result.item_sub_categories_by_pk;
  }

  async createSubcategory(createSubcategoryDto: CreateSubcategoryDto) {
    // First verify that the category exists
    const categoryCheckQuery = `
      query CheckCategoryExists($id: Int!) {
        item_categories_by_pk(id: $id) {
          id
          name
        }
      }
    `;

    const categoryCheck = await this.hasuraSystemService.executeQuery(
      categoryCheckQuery,
      {
        id: createSubcategoryDto.item_category_id,
      }
    );

    if (!categoryCheck.item_categories_by_pk) {
      throw new Error(
        `Category with ID ${createSubcategoryDto.item_category_id} does not exist`
      );
    }

    const mutation = `
      mutation CreateSubcategory($name: String!, $description: String!, $item_category_id: Int!) {
        insert_item_sub_categories_one(object: {
          name: $name,
          description: $description,
          item_category_id: $item_category_id
        }) {
          id
          name
          description
          item_category_id
          created_at
          updated_at
          item_category {
            id
            name
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(mutation, {
      name: createSubcategoryDto.name,
      description: createSubcategoryDto.description,
      item_category_id: createSubcategoryDto.item_category_id,
    });

    this.logger.log(
      `Subcategory created: ${result.insert_item_sub_categories_one.name}`
    );
    return result.insert_item_sub_categories_one;
  }

  async updateSubcategory(
    id: string,
    updateSubcategoryDto: UpdateSubcategoryDto
  ) {
    // If updating category_id, verify that the new category exists
    if (updateSubcategoryDto.item_category_id !== undefined) {
      const categoryCheckQuery = `
        query CheckCategoryExists($id: Int!) {
          item_categories_by_pk(id: $id) {
            id
            name
          }
        }
      `;

      const categoryCheck = await this.hasuraSystemService.executeQuery(
        categoryCheckQuery,
        {
          id: updateSubcategoryDto.item_category_id,
        }
      );

      if (!categoryCheck.item_categories_by_pk) {
        throw new Error(
          `Category with ID ${updateSubcategoryDto.item_category_id} does not exist`
        );
      }
    }

    const mutation = `
      mutation UpdateSubcategory($id: Int!, $name: String, $description: String, $item_category_id: Int) {
        update_item_sub_categories_by_pk(
          pk_columns: { id: $id }
          _set: {
            name: $name,
            description: $description,
            item_category_id: $item_category_id,
            updated_at: "now()"
          }
        ) {
          id
          name
          description
          item_category_id
          created_at
          updated_at
          item_category {
            id
            name
          }
        }
      }
    `;

    const updateData: any = {};
    if (updateSubcategoryDto.name !== undefined) {
      updateData.name = updateSubcategoryDto.name;
    }
    if (updateSubcategoryDto.description !== undefined) {
      updateData.description = updateSubcategoryDto.description;
    }
    if (updateSubcategoryDto.item_category_id !== undefined) {
      updateData.item_category_id = updateSubcategoryDto.item_category_id;
    }

    const result = await this.hasuraSystemService.executeMutation(mutation, {
      id: parseInt(id, 10),
      ...updateData,
    });

    if (result.update_item_sub_categories_by_pk) {
      this.logger.log(
        `Subcategory updated: ${result.update_item_sub_categories_by_pk.name}`
      );
    }
    return result.update_item_sub_categories_by_pk;
  }

  async deleteSubcategory(id: string) {
    // First check if subcategory has associated items
    const checkQuery = `
      query CheckSubcategoryItems($id: Int!) {
        item_sub_categories_by_pk(id: $id) {
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
        id: parseInt(id, 10),
      }
    );

    const subcategory = checkResult.item_sub_categories_by_pk;
    if (!subcategory) {
      return null;
    }

    if (subcategory.items_aggregate.aggregate.count > 0) {
      throw new Error(
        `Cannot delete subcategory "${subcategory.name}" because it has ${subcategory.items_aggregate.aggregate.count} associated items`
      );
    }

    const mutation = `
      mutation DeleteSubcategory($id: Int!) {
        delete_item_sub_categories_by_pk(id: $id) {
          id
          name
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(mutation, {
      id: parseInt(id, 10),
    });

    if (result.delete_item_sub_categories_by_pk) {
      this.logger.log(
        `Subcategory deleted: ${result.delete_item_sub_categories_by_pk.name}`
      );
    }
    return result.delete_item_sub_categories_by_pk;
  }
}
